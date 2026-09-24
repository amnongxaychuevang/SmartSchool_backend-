import prisma from '../database/PrismaClient';
import { addDays, parseClockTime, schoolDateValue, schoolMinutesOfDay } from '../../domain/schoolTime';
import { currentEnrolmentWhere } from './AcademicYear';

// Arrivals after this local time count as late. Configurable per school.
const LATE_AFTER_MINUTES = parseClockTime(process.env.SCHOOL_LATE_AFTER || '07:30');

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

class DailyAttendanceRepository {
  /**
   * First gate tap of the day → present/late. Never overrides a status a teacher
   * set or an approved leave; it only fills in the check-in time.
   */
  async recordCheckIn(studentId: number, time: Date) {
    const date = schoolDateValue(time);
    const status = schoolMinutesOfDay(time) > LATE_AFTER_MINUTES ? 'late' : 'present';

    const existing = await prisma.dailyAttendance.findUnique({
      where: { studentId_date: { studentId, date } },
    });
    if (!existing) {
      try {
        return await prisma.dailyAttendance.create({
          data: { studentId, date, status, source: 'card', firstCheckIn: time },
        });
      } catch (err) {
        // Two taps at the same instant: the other one created the row first.
        if ((err as { code?: string }).code !== 'P2002') throw err;
        return prisma.dailyAttendance.findUnique({ where: { studentId_date: { studentId, date } } });
      }
    }
    if (!existing.firstCheckIn) {
      return prisma.dailyAttendance.update({ where: { id: existing.id }, data: { firstCheckIn: time } });
    }
    return existing;
  }

  /** A class's attendance for one day, for the teacher's marking page. */
  async findForClass(classId: number, date: string) {
    const enrolments = await prisma.classStudent.findMany({
      where: { classId, ...(await currentEnrolmentWhere()) },
      select: { studentId: true },
    });
    return prisma.dailyAttendance.findMany({
      where: { date: schoolDateValue(date), studentId: { in: enrolments.map((e) => e.studentId) } },
    });
  }

  /**
   * Teacher/admin marks a class for a day. Only students currently enrolled in
   * `classId` are accepted, so a teacher can't write another class's attendance.
   */
  async saveForClass(
    classId: number,
    date: string,
    records: { studentId: number; status: AttendanceStatus; note?: string }[],
    recordedBy: number,
  ) {
    const enrolled = new Set(
      (await prisma.classStudent.findMany({
        where: { classId, ...(await currentEnrolmentWhere()) },
        select: { studentId: true },
      })).map((e) => e.studentId),
    );
    const outsiders = records.filter((r) => !enrolled.has(r.studentId)).map((r) => r.studentId);
    if (outsiders.length > 0) {
      throw Object.assign(new Error(`Students not in this class: ${outsiders.join(', ')}`), { statusCode: 400 });
    }

    const day = schoolDateValue(date);
    return prisma.$transaction(
      records.map((r) =>
        prisma.dailyAttendance.upsert({
          where: { studentId_date: { studentId: r.studentId, date: day } },
          create: { studentId: r.studentId, date: day, status: r.status, source: 'teacher', note: r.note ?? null, recordedBy },
          update: { status: r.status, source: 'teacher', note: r.note ?? null, recordedBy },
        }),
      ),
    );
  }

  /**
   * An approved leave marks every day of the leave as excused — except days a
   * teacher already marked explicitly, whose decision stands.
   */
  async markLeave(tx, studentId: number, startDate: Date, endDate: Date) {
    for (let day = schoolDateValue(startDate); day <= schoolDateValue(endDate); day = addDays(day, 1)) {
      const existing = await tx.dailyAttendance.findUnique({ where: { studentId_date: { studentId, date: day } } });
      if (!existing) {
        await tx.dailyAttendance.create({ data: { studentId, date: day, status: 'excused', source: 'leave' } });
      } else if (existing.source !== 'teacher') {
        await tx.dailyAttendance.update({ where: { id: existing.id }, data: { status: 'excused', source: 'leave' } });
      }
    }
  }
}

export default new DailyAttendanceRepository();
