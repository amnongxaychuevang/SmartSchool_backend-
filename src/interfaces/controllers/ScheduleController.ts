import scheduleRepository from '../../infrastructure/repositories/ScheduleRepository';

class ScheduleController {
  async list(req, res, next) {
    try {
      const { classId, termId, dayOfWeek } = req.query;
      let { teacherId } = req.query;

      // If user is a teacher, restrict to their own schedules if not specified
      if (req.user && req.user.role === 'teacher') {
        teacherId = req.user.userId;
      }

      const schedules = await scheduleRepository.findMany({
        teacherId,
        classId,
        termId,
        dayOfWeek
      });
      
      res.json({ success: true, data: schedules });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const schedule = await scheduleRepository.create(req.body);
      res.status(201).json({ success: true, data: { schedule } });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const schedule = await scheduleRepository.update(Number(req.params.id), req.body);
      res.json({ success: true, data: { schedule } });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await scheduleRepository.delete(Number(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export default new ScheduleController();
