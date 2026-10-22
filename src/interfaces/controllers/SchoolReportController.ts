import schoolReportRepository from '../../infrastructure/repositories/SchoolReportRepository';
import { schoolDateString } from '../../domain/schoolTime';

class SchoolReportController {
  async debtors(req, res, next) {
    try {
      const academicYear = typeof req.query.academicYear === 'string' && req.query.academicYear ? req.query.academicYear : undefined;
      res.json({ success: true, data: await schoolReportRepository.debtors(academicYear) });
    } catch (error) {
      next(error);
    }
  }

  async studentStats(req, res, next) {
    try {
      res.json({ success: true, data: await schoolReportRepository.studentStats() });
    } catch (error) {
      next(error);
    }
  }

  async dailyCash(req, res, next) {
    try {
      const date = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : schoolDateString(new Date());
      res.json({ success: true, data: await schoolReportRepository.dailyCash(date) });
    } catch (error) {
      next(error);
    }
  }

  async classResults(req, res, next) {
    try {
      const classId = Number(req.query.classId);
      const termId = Number(req.query.termId);
      if (!classId || !termId) return res.status(400).json({ success: false, message: 'classId and termId are required' });
      res.json({ success: true, data: await schoolReportRepository.classResults(classId, termId) });
    } catch (error) {
      next(error);
    }
  }

  async cashflow(req, res, next) {
    try {
      const { academicYear, startDate, endDate } = req.query;
      const data = await schoolReportRepository.cashflowSummary({
        academicYear: typeof academicYear === 'string' && academicYear ? academicYear : undefined,
        startDate: typeof startDate === 'string' && startDate ? startDate : undefined,
        endDate: typeof endDate === 'string' && endDate ? endDate : undefined,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export default new SchoolReportController();
