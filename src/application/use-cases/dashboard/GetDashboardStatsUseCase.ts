import prisma from '../../../infrastructure/database/PrismaClient';

class GetDashboardStatsUseCase { userAdminRepository?: any; 
  async execute() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalStudents, presentToday, totalTransactionsToday] = await Promise.all([
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
    ]);

    const presentCount = presentToday.length;
    const absentCount = totalStudents - presentCount;

    return {
      totalStudents,
      presentToday: presentCount,
      absentToday: absentCount < 0 ? 0 : absentCount,
      transactionsToday: {
        count: totalTransactionsToday._count.transactionId,
        totalAmount: totalTransactionsToday._sum.amount ?? 0,
      },
    };
  }
}

export default GetDashboardStatsUseCase;
