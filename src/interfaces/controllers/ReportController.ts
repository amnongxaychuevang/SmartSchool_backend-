import GetAttendanceReport from '../../application/use-cases/reports/GetAttendanceReport';
import NotifyAbsence from '../../application/use-cases/reports/NotifyAbsence';

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
}

export default new ReportController();
