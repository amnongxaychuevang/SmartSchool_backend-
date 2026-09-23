import topUpRepository from '../../infrastructure/repositories/TopUpRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';

class TopUpController {
  async list(req, res, next) {
    try {
      const { status, studentId, page = 1, limit = 20 } = req.query;
      // Parents can only ever see their own family's top-up requests — force the
      // scope server-side rather than trusting query params (previously a parent
      // could see every family's requests by omitting/changing studentId).
      const parentUserId = req.user.role === 'parent' ? req.user.userId : undefined;
      const result = await topUpRepository.findMany({
        status,
        studentId,
        parentUserId,
        page: parseInt(page),
        limit: parseInt(limit),
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { studentId, amount, method, methodLabelEn, methodLabelLo, slipUrl } = req.body;

      const request = await topUpRepository.create({
        studentId: parseInt(studentId),
        parentUserId: req.user.userId,
        amount: parseFloat(amount),
        method,
        ...(methodLabelEn ? { methodLabelEn } : {}),
        ...(methodLabelLo ? { methodLabelLo } : {}),
        ...(slipUrl ? { slipUrl } : {}),
      });

      res.status(201).json({ success: true, data: { request } });
    } catch (error) {
      next(error);
    }
  }

  async approve(req, res, next) {
    try {
      const { id } = req.params;
      const result = await topUpRepository.approve(id, req.user.userId);

      auditLogRepository.log({
        userId: req.user.userId,
        action: 'approve',
        entityType: 'top_up_request',
        entityId: id,
        ipAddress: req.ip,
      });

      res.json({ success: true, data: { request: result } });
    } catch (error) {
      next(error);
    }
  }

  async reject(req, res, next) {
    try {
      const { id } = req.params;
      const { rejectReasonEn, rejectReasonLo } = req.body;
      const result = await topUpRepository.reject(id, req.user.userId, rejectReasonEn, rejectReasonLo);

      auditLogRepository.log({
        userId: req.user.userId,
        action: 'reject',
        entityType: 'top_up_request',
        entityId: id,
        detail: { rejectReasonEn, rejectReasonLo },
        ipAddress: req.ip,
      });

      res.json({ success: true, data: { request: result } });
    } catch (error) {
      next(error);
    }
  }
}

export default new TopUpController();
