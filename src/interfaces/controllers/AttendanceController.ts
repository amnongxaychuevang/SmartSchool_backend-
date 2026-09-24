import ScanCard from '../../application/use-cases/attendance/ScanCard';
import notificationService from '../../infrastructure/notifications/TelegramNotificationService';
import cardRepository from '../../infrastructure/repositories/CardRepository';
import attendanceRepository from '../../infrastructure/repositories/AttendanceRepository';
import dailyAttendanceRepository from '../../infrastructure/repositories/DailyAttendanceRepository';
import { teacherHasClass } from '../../infrastructure/repositories/AcademicYear';

// Teachers may only read/mark attendance for their own classes.
const assertTeacherClass = async (user, classId: number) => {
  if (user?.role === 'teacher' && !(await teacherHasClass(user.userId, classId))) {
    throw Object.assign(new Error('You do not teach this class'), { statusCode: 403 });
  }
};

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
      await assertTeacherClass(req.user, Number(classId));
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
      await assertTeacherClass(req.user, classId);
      const saved = await dailyAttendanceRepository.saveForClass(classId, date, records, req.user.userId);
      res.json({ success: true, data: { records: saved } });
    } catch (error) {
      next(error);
    }
  }
}

export default new AttendanceController();
