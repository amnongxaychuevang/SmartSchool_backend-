import prisma from '../../../infrastructure/database/PrismaClient';
import { startOfSchoolDay, addDays, schoolDateString, schoolDateValue } from '../../../domain/schoolTime';

export type ReportRange = 'today' | '7d' | '30d';
type Status = 'present' | 'late' | 'excused' | 'absent' | 'unrecorded';
// Today, a missing row only means the student has not arrived yet.
type Bucket = Status | 'notArrived';

const RANGE_DAYS: Record<ReportRange, number> = { today: 1, '7d': 7, '30d': 30 };

// Monday–Friday on the school clock (dates are UTC midnights of the school date).
const isSchoolDay = (utcMidnight: Date) => {
  const day = utcMidnight.getUTCDay();
  return day >= 1 && day <= 5;
};

type Term = { startDate: Date; endDate: Date } | null;

/**
 * School days (as "YYYY-MM-DD") in the `length` calendar days ending `endOffset`
 * days before today, limited to the active term when there is one (holidays
 * before the term starts are not days of absence).
 */
function schoolDays(length: number, term: Term, endOffset = 0): string[] {
  const today = startOfSchoolDay();
  const days: string[] = [];
  for (let i = length - 1 + endOffset; i >= endOffset; i--) {
    const ymd = schoolDateString(addDays(today, -i));
    const date = schoolDateValue(ymd);
    if (!isSchoolDay(date)) continue;
    if (term && (date < term.startDate || date > term.endDate)) continue;
    days.push(ymd);
  }
  return days;
}

const rate = (attended: number, expected: number) => (expected ? Math.round((attended / expected) * 1000) / 10 : null);

/**
 * Attendance analytics for the admin report page, built only from recorded
 * data: DailyAttendance rows (one per student per school day) for the active
 * roster. A school day with no row for a student is reported as "unrecorded",
 * never guessed as present or absent.
 */
class GetAttendanceReport {
  async execute(range: ReportRange) {
    const length = RANGE_DAYS[range];
    const term = await prisma.academicTerm.findFirst({ where: { status: 'active' }, select: { startDate: true, endDate: true } });
    const days = schoolDays(length, term);
    const previousDays = schoolDays(length, term, length); // the same-length period just before

    const students = await prisma.student.findMany({
      where: { status: 'active' },
      select: {
        studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true,
        classStudents: {
          where: { leftAt: null },
          orderBy: { enrolledAt: 'desc' },
          take: 1,
          select: { class: { select: { classId: true, classNameEn: true, classNameLo: true } } },
        },
      },
    });
    const studentIds = students.map((s) => s.studentId);
    const allDays = [...previousDays, ...days];

    const [records, leaves, notices] = await Promise.all([
      allDays.length
        ? prisma.dailyAttendance.findMany({
          where: { studentId: { in: studentIds }, date: { in: allDays.map((d) => schoolDateValue(d)) } },
          select: { studentId: true, date: true, status: true, firstCheckIn: true },
        })
        : [],
      days.length
        ? prisma.leaveRequest.findMany({
          where: {
            studentId: { in: studentIds }, status: 'approved',
            startDate: { lte: schoolDateValue(days[days.length - 1]) }, endDate: { gte: schoolDateValue(days[0]) },
          },
          select: { studentId: true, startDate: true, endDate: true, reason: true },
        })
        : [],
      prisma.notification.findMany({
        where: { studentId: { in: studentIds }, type: 'absence', sentAt: { gte: addDays(startOfSchoolDay(), -length) } },
        select: { studentId: true, messageEn: true, status: true },
      }),
    ]);

    const statusOf = new Map<string, { status: Status; firstCheckIn: Date | null }>();
    for (const r of records) statusOf.set(`${r.studentId}:${schoolDateString(r.date)}`, { status: r.status, firstCheckIn: r.firstCheckIn });
    const lookup = (studentId: number, day: string): Status => statusOf.get(`${studentId}:${day}`)?.status ?? 'unrecorded';

    // ── Totals for the period and the one before it ──
    const today = schoolDateString(startOfSchoolDay());
    const bucket = (studentId: number, day: string): Bucket => {
      const st = lookup(studentId, day);
      return st === 'unrecorded' && day === today ? 'notArrived' : st;
    };
    const tally = (period: string[]) => {
      const t: Record<Bucket, number> = { present: 0, late: 0, excused: 0, absent: 0, unrecorded: 0, notArrived: 0 };
      for (const s of students) for (const d of period) t[bucket(s.studentId, d)]++;
      return t;
    };
    const current = tally(days);
    const previous = tally(previousDays);
    const expected = students.length * days.length;
    const previousExpected = students.length * previousDays.length;
    const attendanceRate = rate(current.present + current.late, expected);
    const previousRate = rate(previous.present + previous.late, previousExpected);

    // ── Per class ──
    const byClass = new Map<number, { classId: number; classNameEn: string; classNameLo: string; attended: number; expected: number }>();
    for (const s of students) {
      const cls = s.classStudents[0]?.class;
      if (!cls) continue;
      const row = byClass.get(cls.classId) ?? { ...cls, attended: 0, expected: 0 };
      for (const d of days) {
        const st = lookup(s.studentId, d);
        row.expected++;
        if (st === 'present' || st === 'late') row.attended++;
      }
      byClass.set(cls.classId, row);
    }
    const classes = [...byClass.values()]
      .map(({ attended, expected: exp, ...c }) => ({ ...c, expected: exp, attended, rate: rate(attended, exp) }))
      .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));

    // ── Students not in class (absent, excused or unrecorded) ──
    const leaveReason = (studentId: number, day: string) => {
      const date = schoolDateValue(day);
      return leaves.find((l) => l.studentId === studentId && l.startDate <= date && l.endDate >= date)?.reason ?? null;
    };
    // An absence notice names the school date it is about (see NotifyAbsence).
    const notified = (studentId: number, day: string) =>
      notices.find((n) => n.studentId === studentId && n.messageEn.includes(day))?.status ?? null;

    const absentees = [];
    for (const d of [...days].reverse()) {
      for (const s of students) {
        const st = bucket(s.studentId, d);
        if (st === 'present' || st === 'late' || st === 'notArrived') continue;
        const cls = s.classStudents[0]?.class ?? null;
        absentees.push({
          studentId: s.studentId, studentCode: s.studentCode, fullNameEn: s.fullNameEn, fullNameLo: s.fullNameLo,
          classNameEn: cls?.classNameEn ?? null, classNameLo: cls?.classNameLo ?? null,
          date: d, status: st, leaveReason: st === 'excused' ? leaveReason(s.studentId, d) : null,
          notification: notified(s.studentId, d),
        });
      }
    }

    return {
      range,
      schoolDays: days.length,
      students: students.length,
      attendanceRate,
      previousRate,
      breakdown: current,
      notInClass: current.absent + current.excused + current.unrecorded,
      notArrivedToday: current.notArrived,
      excusedShare: rate(current.excused, current.absent + current.excused + current.unrecorded),
      classes,
      absentees: absentees.slice(0, 300),
    };
  }
}

export default GetAttendanceReport;
