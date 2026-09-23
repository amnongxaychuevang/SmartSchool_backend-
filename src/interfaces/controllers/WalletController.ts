import ProcessTransaction from '../../application/use-cases/wallet/ProcessTransaction';
import walletRepository from '../../infrastructure/repositories/WalletRepository';
import shopRepository from '../../infrastructure/repositories/ShopRepository';
import spendingLimitRepository from '../../infrastructure/repositories/SpendingLimitRepository';
import notificationService from '../../infrastructure/notifications/TelegramNotificationService';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';

import { Request, Response, NextFunction } from 'express';

const processTransactionUseCase = new ProcessTransaction(
  walletRepository,
  shopRepository,
  spendingLimitRepository,
  notificationService
);

class WalletController {
  async processTransaction(req: Request | any, res: Response, next: NextFunction) {
    try {
      const { studentId, amount, shopId } = req.body;
      const processedBy = req.user.userId;

      const result = await processTransactionUseCase.execute(studentId, amount, shopId, processedBy);

      auditLogRepository.log({
        userId: processedBy,
        action: 'create',
        entityType: 'wallet_transaction',
        entityId: result.transactionId,
        detail: { studentId, amount, shopId },
        ipAddress: req.ip,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new WalletController();
