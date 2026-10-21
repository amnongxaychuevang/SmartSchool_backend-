import prisma from '../../../infrastructure/database/PrismaClient';
import { currentEnrolmentWhere } from '../../../infrastructure/repositories/AcademicYear';
import { schoolDateString, schoolDateValue } from '../../../domain/schoolTime';
import { isSchoolDay, readAutoAbsenceSettings } from '../../../domain/autoAbsence';
import NotifyAbsence from '../reports/NotifyAbsence';

const notifyAbsence = new NotifyAbsence();

export type AutoAbsenceResult =
  | { date: string; ran: false; reason: 'not_school_day' | 'no_active_term' }
  | { date: string; ran: true; marked: number; notified: number };

/**
 * Marks today's missing students absent (source "auto"). Only students with no
 * attendance row at all are touched, so a gate tap, an approved leave or a
 * teacher's mark always stands, and running it twice changes nothing.
 * A later gate tap still turns "auto absent" into late (see DailyAttendanceRepository).
 */
class MarkAutoAbsences {
  async execute(now: Date = new Date()): Promise<AutoAbsenceResult> {
    const date = schoolDateString(now);
    const day = schoolDateValue(now);
    const row = await prisma.schoolSetting.findUnique({ where: { key: 'autoAbsence' } });
    const settings = readAutoAbsenceSettings(row?.value);

    if (!isSchoolDay(now, settings)) return { date, ran: false, reason: 'not_school_day' };

    // Outside an active term (holidays, between terms) nobody is expected at school.
    const term = await prisma.academicTerm.findFirst({
      where: { status: 'active', startDate: { lte: day }, endDate: { gte: day } },
      select: { termId: true },
    });
    if (!term) return { date, ran: false, reason: 'no_active_term' };

    const missing = await prisma.student.findMany({
      where: {
        status: 'active',
        classStudents: { some: await currentEnrolmentWhere() },
        dailyAttendance: { none: { date: day } },
      },
      select: { studentId: true },
    });
    if (!missing.length) return { date, ran: true, marked: 0, notified: 0 };

    const { count } = await prisma.dailyAttendance.createMany({
      data: missing.map((s) => ({ studentId: s.studentId, date: day, status: 'absent' as const, source: 'auto' as const })),
      skipDuplicates: true, // a tap that arrived meanwhile wins
    });

    let notified = 0;
    if (settings.notifyParents) {
      for (const { studentId } of missing) {
        try {
          await notifyAbsence.execute(studentId, date);
          notified++;
        } catch {
          // No parent linked, already notified, or the student tapped in meanwhile.
        }
      }
    }

    return { date, ran: true, marked: count, notified };
  }
}

export default MarkAutoAbsences;
