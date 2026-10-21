import { Server } from 'socket.io';
import prisma from '../database/PrismaClient';
import schoolEventRepository from '../repositories/SchoolEventRepository';

class DashboardEvents {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  // Emit finance overview update to all connected clients
  async emitFinanceUpdate() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const incomeResult = await prisma.topUpRequest.aggregate({
        _sum: { amount: true },
        where: {
          status: 'approved',
          processedAt: { gte: today, lt: tomorrow },
        },
      });

      const expenseResult = await prisma.walletTransaction.aggregate({
        _sum: { amount: true },
        where: {
          transactionType: 'purchase',
          refund: { is: null },
          createdAt: { gte: today, lt: tomorrow },
        },
      });

      const balanceResult = await prisma.walletAccount.aggregate({
        _sum: { balance: true },
      });

      this.io.emit('dashboard:finance-updated', {
        incomeToday: Number(incomeResult._sum.amount) || 0,
        expensesToday: Number(expenseResult._sum.amount) || 0,
        currentBalance: Number(balanceResult._sum.balance) || 0,
      });
    } catch (error) {
      console.error('Error emitting finance update:', error);
    }
  }

  // Emit top performers update
  async emitTopPerformersUpdate() {
    try {
      const classes = await prisma.class.findMany({
        select: { classId: true, classNameEn: true, classNameLo: true },
      });

      const classesData = await Promise.all(
        classes.map(async (cls) => {
          const students = await prisma.student.findMany({
            where: { classStudents: { some: { classId: cls.classId } } },
            select: {
              studentId: true,
              fullNameLo: true,
              fullNameEn: true,
            },
          });

          const studentsWithGrades = await Promise.all(
            students.map(async (student) => {
              const avg = await prisma.grade.aggregate({
                _avg: { score: true },
                where: { studentId: student.studentId },
              });
              return {
                ...student,
                averageGrade: Number(avg._avg.score) || 0,
              };
            })
          );

          const topStudents = studentsWithGrades
            .sort((a, b) => b.averageGrade - a.averageGrade)
            .slice(0, 3);

          return {
            className: cls.classNameEn,
            classNameEn: cls.classNameEn,
            classNameLo: cls.classNameLo,
            topStudents,
          };
        })
      );

      this.io.emit('dashboard:top-performers-updated', { classes: classesData });
    } catch (error) {
      console.error('Error emitting top performers update:', error);
    }
  }

  // Emit announcements update
  async emitAnnouncementsUpdate() {
    try {
      const now = new Date();
      const announcements = await prisma.announcement.findMany({
        select: {
          announcementId: true,
          titleEn: true,
          titleLo: true,
          contentEn: true,
          contentLo: true,
          targetAudience: true,
          publishDate: true,
        },
        where: {
          publishDate: { lte: now },
          OR: [{ expiryDate: null }, { expiryDate: { gte: now } }],
        },
        orderBy: { publishDate: 'desc' },
        take: 5,
      });

      const mapped = announcements.map((a) => ({
        id: a.announcementId,
        titleLo: a.titleLo,
        titleEn: a.titleEn,
        contentLo: a.contentLo,
        contentEn: a.contentEn,
        priority: a.targetAudience === 'all' ? 'high' : 'medium',
        createdAt: a.publishDate,
      }));

      this.io.emit('dashboard:announcements-updated', { announcements: mapped });
    } catch (error) {
      console.error('Error emitting announcements update:', error);
    }
  }

  // Emit upcoming events update (Term 2: 2027-02-01 to 2027-06-30)
  async emitUpcomingEventsUpdate() {
    try {
      const events = await schoolEventRepository.upcomingForDashboard(5);
      this.io.emit('dashboard:events-updated', { events });
    } catch (error) {
      console.error('Error emitting events update:', error);
    }
  }

  // Setup periodic updates (every 30 seconds)
  setupPeriodicUpdates() {
    setInterval(async () => {
      try {
        await this.emitFinanceUpdate();
        await this.emitTopPerformersUpdate();
        await this.emitAnnouncementsUpdate();
        await this.emitUpcomingEventsUpdate();
      } catch (error) {
        console.error('Error in periodic dashboard updates:', error);
      }
    }, 30000); // 30 seconds

    // Emit initial data immediately on first connection
    this.emitFinanceUpdate();
    this.emitTopPerformersUpdate();
    this.emitAnnouncementsUpdate();
    this.emitUpcomingEventsUpdate();
  }
}

export default DashboardEvents;
