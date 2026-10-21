import GetDashboardStatsUseCase from '../../application/use-cases/dashboard/GetDashboardStatsUseCase';
import prisma from '../../infrastructure/database/PrismaClient';

const getDashboardStatsUseCase = new GetDashboardStatsUseCase();

class DashboardController {
  async stats(req, res, next) {
    try {
      const data = await getDashboardStatsUseCase.execute();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async financeOverview(req, res, next) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Income: sum of top-up requests approved today (use processedAt)
      const incomeResult = await prisma.topUpRequest.aggregate({
        _sum: { amount: true },
        where: {
          status: 'approved',
          processedAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      // Expenses: sum of wallet transactions (purchases) today
      const expenseResult = await prisma.walletTransaction.aggregate({
        _sum: { amount: true },
        where: {
          transactionType: 'purchase',
          refund: { is: null },
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      // Current balance: total of all wallet accounts
      const balanceResult = await prisma.walletAccount.aggregate({
        _sum: { balance: true },
      });

      res.json({
        success: true,
        data: {
          incomeToday: Number(incomeResult._sum.amount) || 0,
          expensesToday: Number(expenseResult._sum.amount) || 0,
          currentBalance: Number(balanceResult._sum.balance) || 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async topPerformers(req, res, next) {
    try {
      // Get all classes with top 3 students by average grade
      const classes = await prisma.class.findMany({
        select: { classId: true, classNameEn: true, classNameLo: true },
      });

      const classesData = await Promise.all(
        classes.map(async (cls) => {
          // Get all students in the class
          const students = await prisma.student.findMany({
            where: { classStudents: { some: { classId: cls.classId } } },
            select: {
              studentId: true,
              fullNameLo: true,
              fullNameEn: true,
            },
          });

          // Get average grade for each student
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

          // Sort by average grade and take top 3
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

      res.json({ success: true, data: { classes: classesData } });
    } catch (error) {
      next(error);
    }
  }

  async announcements(req, res, next) {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 5, 50);
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
          author: { select: { fullNameEn: true, fullNameLo: true } },
        },
        where: {
          publishDate: { lte: now },
          OR: [{ expiryDate: null }, { expiryDate: { gte: now } }],
        },
        orderBy: { publishDate: 'desc' },
        take: limit,
      });

      // Map to expected format with priority based on target audience
      const mapped = announcements.map((a) => ({
        id: a.announcementId,
        titleLo: a.titleLo,
        titleEn: a.titleEn,
        contentLo: a.contentEn, // Note: backend stores in EN, map accordingly
        contentEn: a.contentEn,
        priority: a.targetAudience === 'all' ? 'high' : 'medium',
        createdAt: a.publishDate,
      }));

      res.json({ success: true, data: { announcements: mapped } });
    } catch (error) {
      next(error);
    }
  }

  async upcomingEvents(req, res, next) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 5, 50);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const academicTerms = await prisma.academicTerm.findMany({
        select: {
          termId: true,
          termNameEn: true,
          termNameLo: true,
          startDate: true,
          endDate: true,
        },
        where: { startDate: { gte: today } },
        orderBy: { startDate: 'asc' },
        take: limit,
      });

      const events = academicTerms.map((term) => ({
        id: term.termId.toString(),
        nameEn: term.termNameEn,
        nameLo: term.termNameLo,
        date: term.startDate.toISOString(),
        type: 'event',
      }));

      res.json({ success: true, data: { events } });
    } catch (error) {
      next(error);
    }
  }
}

export default new DashboardController();
