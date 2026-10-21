import GetAttendanceReport from '../../application/use-cases/reports/GetAttendanceReport';
import NotifyAbsence from '../../application/use-cases/reports/NotifyAbsence';
import prisma from '../../infrastructure/database/PrismaClient';

const getAttendanceReport = new GetAttendanceReport();
const notifyAbsence = new NotifyAbsence();

class ReportController {
  // GET /reports/attendance?range=today|7d|30d
  async attendance(req, res, next) {
    try {
      const data = await getAttendanceReport.execute(req.query.range ?? 'today');
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  // POST /reports/attendance/notify  { studentId, date }
  async notifyAbsence(req, res, next) {
    try {
      const { studentId, date } = req.body;
      const data = await notifyAbsence.execute(studentId, date);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
  // GET /reports/shop-sales?from=2026-10-01&to=2026-10-19
  async shopSales(req, res, next) {
    try {
      const { from, to } = req.query;

      const now = new Date();
      const dateFrom = from ? new Date(`${from}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dateTo = to ? new Date(`${to}T23:59:59.999`) : new Date(dateFrom.getTime() + 86400000 - 1);

      const rows = await prisma.walletTransaction.groupBy({
        by: ['shopId'],
        where: {
          transactionType: 'purchase',
          refund: { is: null }, // refunded sales were given back
          shopId: { not: null },
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        _sum: { amount: true },
        _count: { _all: true },
      });

      const shopIds = rows.map(r => r.shopId).filter(Boolean) as number[];
      const shops = await prisma.shop.findMany({
        where: { shopId: { in: shopIds } },
        select: { shopId: true, shopNameEn: true, shopNameLo: true, locationEn: true, locationLo: true },
      });
      const shopMap = Object.fromEntries(shops.map(s => [s.shopId, s]));

      const summary = rows.map(r => ({
        shopId: r.shopId,
        shop: shopMap[r.shopId!] || null,
        totalAmount: Number(r._sum.amount || 0),
        transactionCount: r._count._all,
      })).sort((a, b) => b.totalAmount - a.totalAmount);

      const grandTotal = summary.reduce((s, r) => s + r.totalAmount, 0);
      const totalTransactions = summary.reduce((s, r) => s + r.transactionCount, 0);

      res.json({
        success: true,
        data: { summary, grandTotal, totalTransactions, from: dateFrom, to: dateTo },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ReportController();
