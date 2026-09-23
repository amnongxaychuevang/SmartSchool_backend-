import scheduleRepository from '../../infrastructure/repositories/ScheduleRepository';

class ScheduleController {
  async list(req, res, next) {
    try {
      const { classId, dayOfWeek } = req.query;
      let { teacherId } = req.query;

      // If user is a teacher, restrict to their own schedules if not specified
      if (req.user && req.user.role === 'teacher') {
        teacherId = req.user.userId;
      }

      const schedules = await scheduleRepository.findMany({
        teacherId,
        classId,
        dayOfWeek
      });
      
      res.json({ success: true, data: schedules });
    } catch (error) {
      next(error);
    }
  }
}

export default new ScheduleController();
