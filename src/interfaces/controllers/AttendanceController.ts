import ScanCard from '../../application/use-cases/attendance/ScanCard';
import notificationService from '../../infrastructure/notifications/TelegramNotificationService';
import cardRepository from '../../infrastructure/repositories/CardRepository';
import attendanceRepository from '../../infrastructure/repositories/AttendanceRepository';
import dailyAttendanceRepository from '../../infrastructure/repositories/DailyAttendanceRepository';

const scanCardUseCase = new ScanCard(
  cardRepository,
  attendanceRepository,
  notificationService,
  dailyAttendanceRepository
);

class AttendanceController {
  async scanCard(req, res, next) {
    try {
      const { cardUid, gateLocation } = req.body;

      const result = await scanCardUseCase.execute(cardUid, gateLocation);

      if (req.app.get('socketManager')) {
        req.app.get('socketManager').broadcast('live-feed-update', result);
      }

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // GET /attendance/daily?classId=&date=YYYY-MM-DD
  async listDaily(req, res, next) {
    try {
      const { classId, date } = req.query;
      const records = await dailyAttendanceRepository.findForClass(Number(classId), String(date));
      res.json({ success: true, data: { records } });
    } catch (error) {
      next(error);
    }
  }

  // PUT /attendance/daily  { classId, date, records: [{ studentId, status, note? }] }
  async saveDaily(req, res, next) {
    try {
      const { classId, date, records } = req.body;
      const saved = await dailyAttendanceRepository.saveForClass(classId, date, records, req.user.userId);
      res.json({ success: true, data: { records: saved } });
    } catch (error) {
      next(error);
    }
  }
}

export default new AttendanceController();
