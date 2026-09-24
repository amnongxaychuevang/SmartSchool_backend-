import prisma from '../../../infrastructure/database/PrismaClient';
import { startOfSchoolDay, addDays, schoolDateString, schoolDateValue } from '../../../domain/schoolTime';

// Monday–Friday; a weekend is not a day of absence.
const isSchoolDay = (day: Date) => {
  const weekday = schoolDateValue(day).getUTCDay();
  return weekday >= 1 && weekday <= 5;
};

class GetDashboardStatsUseCase { userAdminRepository?: any;
  async execute() {
    const today = startOfSchoolDay();
    const tomorrow = addDays(today, 1);

    // Wallet trend: the last 7 calendar days. Attendance trend: the last 7 school days.
    const sevenDaysAgo = addDays(today, -6);
    const schoolDays: Date[] = [];
    for (let d = today; schoolDays.length < 7; d = addDays(d, -1)) if (isSchoolDay(d)) schoolDays.unshift(d);

    const [totalStudents, totalTransactionsToday, attendanceRows, weekWalletTxns] = await Promise.all([
      prisma.student.count({ where: { status: 'active' } }),
      prisma.walletTransaction.aggregate({
        where: { createdAt: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
        _count: { transactionId: true },
      }),
      // Daily status rows (present / late / excused / absent), not raw gate taps:
      // a teacher-marked or excused student has no tap but is correctly counted.
      prisma.dailyAttendance.groupBy({
        by: ['date', 'status'],
        where: { date: { in: schoolDays.map((d) => schoolDateValue(d)) }, student: { status: 'active' } },
        _count: { _all: true },
      }),
      prisma.walletTransaction.findMany({
        where: { createdAt: { gte: sevenDaysAgo, lt: tomorrow } },
        select: { amount: true, createdAt: true },
      }),
    ]);

    const countFor = (day: Date, statuses: string[]) => attendanceRows
      .filter((r) => schoolDateString(r.date) === schoolDateString(schoolDateValue(day)) && statuses.includes(r.status))
      .reduce((sum, r) => sum + r._count._all, 0);

    const todayIsSchoolDay = isSchoolDay(today);
    const presentCount = todayIsSchoolDay ? countFor(today, ['present', 'late']) : 0;
    const excusedCount = todayIsSchoolDay ? countFor(today, ['excused']) : 0;
    // Not at school today: marked absent, or no check-in yet. Zero on weekends.
    const absentCount = todayIsSchoolDay ? Math.max(totalStudents - presentCount - excusedCount, 0) : 0;

    // Approximate for past days: measured against today's active-student count,
    // not a historical roster snapshot — fine for a trend widget, not an audit record.
    const attendanceTrend = schoolDays.map((day) => {
      const present = countFor(day, ['present', 'late']);
      const excused = countFor(day, ['excused']);
      return { date: schoolDateString(day), present, excused, absent: Math.max(totalStudents - present - excused, 0) };
    });

    const days: Date[] = [];
    for (let i = 6; i >= 0; i--) days.push(addDays(today, -i));

    const walletTrend = days.map((dayStart) => {
      const dayEnd = addDays(dayStart, 1);
      const totalAmount = weekWalletTxns
        .filter((t) => t.createdAt >= dayStart && t.createdAt < dayEnd)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      return { date: schoolDateString(dayStart), totalAmount };
    });

    return {
      totalStudents,
      isSchoolDay: todayIsSchoolDay,
      presentToday: presentCount,
      excusedToday: excusedCount,
      absentToday: absentCount,
      transactionsToday: {
        count: totalTransactionsToday._count.transactionId,
        totalAmount: totalTransactionsToday._sum.amount ?? 0,
      },
      attendanceTrend,
      walletTrend,
    };
  }
}

export default GetDashboardStatsUseCase;
