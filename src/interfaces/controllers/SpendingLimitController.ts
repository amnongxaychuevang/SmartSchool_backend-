import spendingLimitRepository from '../../infrastructure/repositories/SpendingLimitRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';

class SpendingLimitController {
  async getByStudent(req, res, next) {
    try {
      const { studentId } = req.params;
      const limit = await spendingLimitRepository.findByStudent(studentId);
      res.json({ success: true, data: { spendingLimit: limit } });
    } catch (error) {
      next(error);
    }
  }

  async upsert(req, res, next) {
    try {
      const { studentId } = req.params;
      const { dailyMax, weeklyMax, perTransactionMax, alertThreshold, blockedShops, notes } = req.body;

      const data: any = {};
      if (dailyMax !== undefined) data.dailyMax = dailyMax ? parseFloat(dailyMax) : null;
      if (weeklyMax !== undefined) data.weeklyMax = weeklyMax ? parseFloat(weeklyMax) : null;
      if (perTransactionMax !== undefined) data.perTransactionMax = perTransactionMax ? parseFloat(perTransactionMax) : null;
      if (alertThreshold !== undefined) data.alertThreshold = alertThreshold ? parseFloat(alertThreshold) : null;
      if (blockedShops !== undefined) data.blockedShops = blockedShops;
      if (notes !== undefined) data.notes = notes;

      const spendingLimit = await spendingLimitRepository.upsert(studentId, data, req.user.userId);

      auditLogRepository.log({
        userId: req.user.userId,
        action: 'update',
        entityType: 'spending_limit',
        entityId: studentId,
        detail: data,
        ipAddress: req.ip,
      });

      res.json({ success: true, data: { spendingLimit } });
    } catch (error) {
      next(error);
    }
  }
}

export default new SpendingLimitController();
