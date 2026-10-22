import leaveRequestRepository from '../../infrastructure/repositories/LeaveRequestRepository';

class LeaveRequestController {
  async list(req, res, next) {
    try {
      const { status, studentId, search, page, limit } = req.query;
      let homeroomTeacherId = null;

      // If user is a teacher, restrict to students in their homeroom classes
      if (req.user && req.user.role === 'teacher') {
        homeroomTeacherId = req.user.userId;
      }

      const result = await leaveRequestRepository.findMany({
        studentId,
        homeroomTeacherId,
        status,
        search: typeof search === 'string' && search.trim() ? search.trim() : undefined,
        page: Math.max(1, parseInt(page) || 1),
        limit: Math.min(100, Math.max(1, parseInt(limit) || 20)),
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

      const homeroomTeacherId = req.user.role === 'teacher' ? req.user.userId : null;
      const result = await leaveRequestRepository.updateStatus(id, status, req.user.userId, homeroomTeacherId);

      const socketManager = req.app.get('socketManager');
      if (socketManager && result?.parentUserId) {
        const studentName = result.student ? (result.student.fullNameLo || result.student.fullNameEn) : 'ນັກຮຽນ';
        const isApproved = status === 'approved';
        socketManager.toUser(result.parentUserId, 'new-notification', {
          titleLo: isApproved ? 'ຄຳຂໍລາພັກໄດ້ຮັບການອະນຸມັດ' : 'ຄຳຂໍລາພັກຖືກປະຕິເສດ',
          titleEn: isApproved ? 'Leave Request Approved' : 'Leave Request Rejected',
          messageLo: `ຄຳຂໍລາພັກຂອງ ${studentName} ໄດ້ຮັບການ${isApproved ? 'ອະນຸມັດ' : 'ປະຕິເສດ'}ແລ້ວ`,
          messageEn: `Leave request for ${studentName} has been ${status}`,
          link: '/parent/leave',
        });
      }

      res.json({ success: true, data: { request: result } });
    } catch (error) {
      next(error);
    }
  }
}

export default new LeaveRequestController();
