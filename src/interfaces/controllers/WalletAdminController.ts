import walletRepository from '../../infrastructure/repositories/WalletRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';
import dispatcher from '../../infrastructure/notifications/NotificationDispatcher';

const kip = (n: number) => n.toLocaleString('en-US');

class WalletAdminController {
  async listWallets(req, res, next) {
    try {
      const { search = '', status, page = 1, limit = 20 } = req.query;
      const result = await walletRepository.findAll({
        search,
        status,
        page: parseInt(page),
        limit: parseInt(limit),
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getWalletByStudent(req, res, next) {
    try {
      const { studentId } = req.params;
      const wallet = await walletRepository.findByStudent(studentId);
      if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });
      res.json({ success: true, data: { wallet } });
    } catch (error) {
      next(error);
    }
  }

  async listTransactions(req, res, next) {
    try {
      const { walletId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const result = await walletRepository.findTransactions({
        walletId,
        page: parseInt(page),
        limit: parseInt(limit),
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async topUp(req, res, next) {
    try {
      const { walletId } = req.params;
      const { amount, descriptionEn, descriptionLo } = req.body;

      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid amount' });
      }

      const transaction = await walletRepository.topUp(
        walletId,
        amount,
        req.user.userId,
        descriptionEn,
        descriptionLo,
      );

      auditLogRepository.log({
        userId: req.user.userId,
        action: 'create',
        entityType: 'wallet_transaction',
        entityId: walletId,
        detail: { amount },
        ipAddress: req.ip,
      });

      res.json({ success: true, data: { transaction } });
    } catch (error) {
      next(error);
    }
  }

  // POST /wallet-transactions/:transactionId/refund — undo a wrong or cancelled shop purchase.
  async refund(req, res, next) {
    try {
      const transactionId = parseInt(req.params.transactionId);
      const { reason } = req.body;
      const { refund, studentId, balanceAfter } = await walletRepository.refundPurchase(transactionId, req.user.userId, reason);

      auditLogRepository.log({
        userId: req.user.userId,
        action: 'create',
        entityType: 'wallet_refund',
        entityId: transactionId,
        detail: { refundTransactionId: refund.transactionId, amount: Number(refund.amount), reason },
        ipAddress: req.ip,
      });

      dispatcher.notifyParents(
        studentId,
        'transaction',
        `Refund of ${kip(Number(refund.amount))} LAK: ${reason}. Balance: ${kip(balanceAfter)} LAK.`,
        `ຄືນເງິນ ${kip(Number(refund.amount))} ກີບ: ${reason}. ຍອດເຫຼືອ: ${kip(balanceAfter)} ກີບ.`,
      ).catch((err) => console.error('Failed to notify parents of refund:', err));

      res.status(201).json({ success: true, data: { transaction: refund } });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { walletId } = req.params;
      const { status } = req.body;
      if (!['active', 'frozen'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }
      const wallet = await walletRepository.updateStatus(walletId, status);

      auditLogRepository.log({
        userId: req.user.userId,
        action: 'status_change',
        entityType: 'wallet',
        entityId: walletId,
        detail: { status },
        ipAddress: req.ip,
      });

      res.json({ success: true, data: { wallet } });
    } catch (error) {
      next(error);
    }
  }
}

export default new WalletAdminController();
