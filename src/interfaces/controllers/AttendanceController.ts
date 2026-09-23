import ScanCard from '../../application/use-cases/attendance/ScanCard';
import notificationService from '../../infrastructure/notifications/TelegramNotificationService';
import cardRepository from '../../infrastructure/repositories/CardRepository';
import attendanceRepository from '../../infrastructure/repositories/AttendanceRepository';

const scanCardUseCase = new ScanCard(
  cardRepository,
  attendanceRepository,
  notificationService
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
}

export default new AttendanceController();
