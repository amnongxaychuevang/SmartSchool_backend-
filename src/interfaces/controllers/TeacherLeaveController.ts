import teacherLeaveRepository from '../../infrastructure/repositories/TeacherLeaveRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';

class TeacherLeaveController {
  // ── Teacher portal ──
  async listMine(req, res, next) {
    try {
      res.json({ success: true, data: { leaves: await teacherLeaveRepository.listMine(req.user.userId) } });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const leave = await teacherLeaveRepository.create(req.user.userId, req.body);
      res.status(201).json({ success: true, data: { leave } });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      await teacherLeaveRepository.cancel(req.user.userId, Number(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // ── Admin ──
  async list(req, res, next) {
    try {
      const result = await teacherLeaveRepository.list({
        status: req.query.status,
        search: typeof req.query.search === 'string' ? req.query.search.trim() : '',
        page: Math.max(1, parseInt(req.query.page) || 1),
        limit: Math.min(100, Math.max(1, parseInt(req.query.limit) || 15)),
      });
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async decide(req, res, next) {
    try {
      const leave = await teacherLeaveRepository.decide(Number(req.params.id), req.body.status, req.user.userId, req.body.note);
      await auditLogRepository.log({
        userId: req.user.userId,
        action: req.body.status === 'approved' ? 'approve' : 'reject',
        entityType: 'teacher_leave',
        entityId: req.params.id,
        detail: { teacherUserId: leave?.teacherUserId, note: req.body.note || undefined },
        ipAddress: req.ip,
      });
      res.json({ success: true, data: { leave } });
    } catch (error) {
      next(error);
    }
  }
}

export default new TeacherLeaveController();
