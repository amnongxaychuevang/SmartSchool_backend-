import leaveRequestRepository from '../../infrastructure/repositories/LeaveRequestRepository';

class LeaveRequestController {
  async list(req, res, next) {
    try {
      const { status, studentId, page, limit } = req.query;
      let homeroomTeacherId = null;

      // If user is a teacher, restrict to students in their homeroom classes
      if (req.user && req.user.role === 'teacher') {
        homeroomTeacherId = req.user.userId;
      }

      const result = await leaveRequestRepository.findMany({
        studentId,
        homeroomTeacherId,
        status,
        page,
        limit
      });
      
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body; // 'approved' or 'rejected'

      const result = await leaveRequestRepository.updateStatus(id, status, req.user.userId);
      res.json({ success: true, data: { request: result } });
    } catch (error) {
      next(error);
    }
  }
}

export default new LeaveRequestController();
