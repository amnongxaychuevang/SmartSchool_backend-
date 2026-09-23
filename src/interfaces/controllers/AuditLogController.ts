import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';

class AuditLogController {
  async list(req, res, next) {
    try {
      const { userId, entityType, action, page = 1, limit = 50 } = req.query;
      const result = await auditLogRepository.findMany({
        userId,
        entityType,
        action,
        page: parseInt(page),
        limit: parseInt(limit),
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuditLogController();
