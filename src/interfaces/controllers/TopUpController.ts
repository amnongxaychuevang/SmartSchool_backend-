import topUpRepository from '../../infrastructure/repositories/TopUpRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';
import dispatcher from '../../infrastructure/notifications/NotificationDispatcher';

const kip = (amount) => Number(amount).toLocaleString('en-US');

// Tell the family the outcome; a delivery failure must not undo the decision.
const notifyOutcome = (studentId: number, messageEn: string, messageLo: string) =>
  dispatcher.notifyParents(studentId, 'transaction', messageEn, messageLo)
    .catch((err) => console.error('Failed to notify parents of top-up outcome:', err));

class TopUpController {
  async list(req, res, next) {
    try {
      const { status, studentId, search, page = 1, limit = 20 } = req.query;
      // Parents can only ever see their own family's top-up requests — force the
      // scope server-side rather than trusting query params (previously a parent
      // could see every family's requests by omitting/changing studentId).
      const parentUserId = req.user.role === 'parent' ? req.user.userId : undefined;
      const result = await topUpRepository.findMany({
        status,
        studentId,
        search,
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
      const { studentId, amount, method, slipUrl } = req.body;

      const request = await topUpRepository.create({
        studentId: parseInt(studentId),
        parentUserId: req.user.userId,
        amount: parseFloat(amount),
        method,
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
      notifyOutcome(
        result.studentId,
        `Your top-up of ${kip(result.amount)} LAK has been approved and added to the wallet.`,
        `ການເຕີມເງິນ ${kip(result.amount)} ກີບ ໄດ້ຮັບການອະນຸມັດ ແລະ ເຂົ້າກະເປົາແລ້ວ.`,
      );

      res.json({ success: true, data: { request: result } });
    } catch (error) {
      next(error);
    }
  }

  async reject(req, res, next) {
    try {
      const { id } = req.params;
      const { rejectReason } = req.body;
      const result = await topUpRepository.reject(id, req.user.userId, rejectReason);

      auditLogRepository.log({
        userId: req.user.userId,
        action: 'reject',
        entityType: 'top_up_request',
        entityId: id,
        detail: { rejectReason },
        ipAddress: req.ip,
      });
      notifyOutcome(
        result.studentId,
        `Your top-up of ${kip(result.amount)} LAK was not approved.${rejectReason ? ` Reason: ${rejectReason}` : ''}`,
        `ການເຕີມເງິນ ${kip(result.amount)} ກີບ ບໍ່ໄດ້ຮັບການອະນຸມັດ.${rejectReason ? ` ເຫດຜົນ: ${rejectReason}` : ''}`,
      );

      res.json({ success: true, data: { request: result } });
    } catch (error) {
      next(error);
    }
  }
}

export default new TopUpController();
