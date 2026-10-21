import promotionRepository from '../../infrastructure/repositories/PromotionRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';

class PromotionController {
  // GET /promotion/preview?fromYear=2026-2027&toYear=2027-2028
  async preview(req, res, next) {
    try {
      const { fromYear, toYear } = req.query;
      res.json({ success: true, data: await promotionRepository.preview(fromYear, toYear) });
    } catch (error) {
      next(error);
    }
  }

  // POST /promotion/apply — { fromYear, toYear, moves: [...] }
  async apply(req, res, next) {
    try {
      const { fromYear, toYear, moves } = req.body;
      const result = await promotionRepository.apply(fromYear, toYear, moves);
      auditLogRepository.log({
        userId: req.user.userId,
        action: 'update',
        entityType: 'promotion',
        detail: { fromYear, toYear, ...result },
        ipAddress: req.ip,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new PromotionController();
