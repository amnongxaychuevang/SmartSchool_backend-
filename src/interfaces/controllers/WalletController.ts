import ProcessTransaction from '../../application/use-cases/wallet/ProcessTransaction';
import walletRepository from '../../infrastructure/repositories/WalletRepository';
import shopRepository from '../../infrastructure/repositories/ShopRepository';
import spendingLimitRepository from '../../infrastructure/repositories/SpendingLimitRepository';
import cardRepository from '../../infrastructure/repositories/CardRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';
import { startOfSchoolDay } from '../../domain/schoolTime';

import { Request, Response, NextFunction } from 'express';

const processTransactionUseCase = new ProcessTransaction(
  walletRepository,
  shopRepository,
  spendingLimitRepository,
);

const fail = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

// The card must match exactly and be usable today: a lost, deactivated or
// expired card can never be charged, whatever the browser shows.
async function usableCard(cardUid: string) {
  const card = await cardRepository.findForPos(cardUid.trim());
  if (!card) throw fail('Card not found', 404);
  if (card.status !== 'active') throw fail(`Card is ${card.status}`, 422);
  if (card.expiredDate && card.expiredDate < startOfSchoolDay()) throw fail('Card has expired', 422);
  return card;
}

class WalletController {
  // GET /wallet/card/:uid — what the cashier sees after scanning a card.
  async lookupCard(req: Request | any, res: Response, next: NextFunction) {
    try {
      const card = await usableCard(String(req.params.uid));
      const { classStudents, walletAccount, ...student } = card.student;
      res.json({
        success: true,
        data: {
          cardUid: card.cardUid,
          student: { ...student, class: classStudents[0]?.class ?? null },
          wallet: walletAccount
            ? { balance: Number(walletAccount.balance), status: walletAccount.status }
            : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /wallet/process — charge the student who owns the scanned card.
  async processTransaction(req: Request | any, res: Response, next: NextFunction) {
    try {
      const { cardUid, amount, shopId } = req.body;
      const processedBy = req.user.userId;
      const card = await usableCard(cardUid);
      const studentId = card.studentId;

      const result = await processTransactionUseCase.execute(studentId, amount, shopId, processedBy);

      auditLogRepository.log({
        userId: processedBy,
        action: 'create',
        entityType: 'wallet_transaction',
        entityId: result.transactionId,
        detail: { studentId, cardUid: card.cardUid, amount, shopId },
        ipAddress: req.ip,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new WalletController();
