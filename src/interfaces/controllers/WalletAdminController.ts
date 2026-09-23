import walletRepository from '../../infrastructure/repositories/WalletRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';

class WalletAdminController {
  async listWallets(req, res, next) {
    try {
      const { search = '', page = 1, limit = 20 } = req.query;
      const result = await walletRepository.findAll({
        search,
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
