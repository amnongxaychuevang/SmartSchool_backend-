import prisma from '../../../infrastructure/database/PrismaClient';
import { startOfSchoolDay, addDays, schoolDateString } from '../../../domain/schoolTime';

class GetDashboardStatsUseCase { userAdminRepository?: any;
  async execute() {
    const today = startOfSchoolDay();
    const tomorrow = addDays(today, 1);

    // 7-day trend window (today + 6 days back)
    const sevenDaysAgo = addDays(today, -6);

    const [totalStudents, presentToday, totalTransactionsToday, weekAttendanceLogs, weekWalletTxns] = await Promise.all([
      prisma.student.count({ where: { status: 'active' } }),
      prisma.attendanceLog.groupBy({
        by: ['studentId'],
        where: { logTime: { gte: today, lt: tomorrow }, logType: 'check_in' },
      }),
      prisma.walletTransaction.aggregate({
        where: { createdAt: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
        _count: { transactionId: true },
      }),
      prisma.attendanceLog.findMany({
        where: { logTime: { gte: sevenDaysAgo, lt: tomorrow }, logType: 'check_in' },
        select: { studentId: true, logTime: true },
      }),
      prisma.walletTransaction.findMany({
        where: { createdAt: { gte: sevenDaysAgo, lt: tomorrow } },
        select: { amount: true, createdAt: true },
      }),
    ]);

    const presentCount = presentToday.length;
    const absentCount = totalStudents - presentCount;

    // Build the 7 day buckets (oldest -> newest) once, reused for both trends.
    const days: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      days.push(addDays(today, -i));
    }

    const attendanceTrend = days.map((dayStart) => {
      const dayEnd = addDays(dayStart, 1);
      // A student may check in/out multiple times a day — count each student once.
      const presentSet = new Set(
        weekAttendanceLogs
          .filter((l) => l.logTime >= dayStart && l.logTime < dayEnd)
          .map((l) => l.studentId)
      );
      const present = presentSet.size;
      return {
        date: schoolDateString(dayStart),
        present,
        // Approximate: measured against today's active-student count, not a
        // historical roster snapshot — fine for a trend widget, not an audit record.
        absent: Math.max(totalStudents - present, 0),
      };
    });

    const walletTrend = days.map((dayStart) => {
      const dayEnd = addDays(dayStart, 1);
      const totalAmount = weekWalletTxns
        .filter((t) => t.createdAt >= dayStart && t.createdAt < dayEnd)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      return { date: schoolDateString(dayStart), totalAmount };
    });

    return {
      totalStudents,
      presentToday: presentCount,
      absentToday: absentCount < 0 ? 0 : absentCount,
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
