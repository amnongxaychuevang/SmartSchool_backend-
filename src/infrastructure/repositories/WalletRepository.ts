import prisma from '../database/PrismaClient';
import Wallet from '../../domain/entities/Wallet';

const fail = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

class WalletRepository {
  async findAll({ search = '', page = 1, limit = 20 }: any = {}) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          student: {
            OR: [
              { fullNameEn: { contains: search } },
              { fullNameLo: { contains: search } },
              { studentCode: { contains: search } },
            ],
          },
        }
      : {};

    const [wallets, total] = await Promise.all([
      prisma.walletAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          student: {
            select: {
              studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true,
              spendingLimit: { select: { dailyMax: true } },
            },
          },
        },
      }),
      prisma.walletAccount.count({ where }),
    ]);

    return { wallets, total, page, limit };
  }

  async findByStudent(studentId) {
    return prisma.walletAccount.findUnique({
      where: { studentId: parseInt(studentId) },
      include: {
        student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } },
      },
    });
  }

  async findTransactions({ walletId, page = 1, limit = 20 }: any = {}) {
    const skip = (page - 1) * limit;
    const where = { walletId: parseInt(walletId) };

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          shop: { select: { shopId: true, shopNameEn: true, shopNameLo: true } },
          processor: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
          refund: { select: { transactionId: true, createdAt: true } },
        },
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    return { transactions, total, page, limit };
  }

  async topUp(walletId, amount, processedBy, descriptionEn = 'Top-up', descriptionLo = 'ເຕີມເງິນ') {
    return prisma.$transaction(async (tx) => {
      const wallet = await tx.walletAccount.findUnique({ where: { walletId: parseInt(walletId) } });
      if (!wallet) throw new Error('Wallet not found');
      if (wallet.status === 'frozen') throw new Error('Wallet is frozen');

      const balanceBefore = Number(wallet.balance);
      const balanceAfter = balanceBefore + Number(amount);

      await tx.walletAccount.update({
        where: { walletId: parseInt(walletId) },
        data: { balance: balanceAfter },
      });

      return tx.walletTransaction.create({
        data: {
          walletId: parseInt(walletId),
          transactionType: 'top_up',
          amount: Number(amount),
          balanceBefore,
          balanceAfter,
          descriptionEn,
          descriptionLo,
          processedBy: processedBy ? parseInt(processedBy) : null,
          referenceNo: `TU-${Date.now()}`,
        },
      });
    });
  }

  /**
   * Reverses a shop purchase: the amount goes back to the wallet as a "refund"
   * transaction that points at the purchase. refund_of_id is unique, so a
   * purchase is refunded at most once, even if two people click at the same time.
   * Works on a frozen wallet too: money going back to the student is always allowed.
   */
  async refundPurchase(transactionId: number, processedBy: number, reason: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const purchase = await tx.walletTransaction.findUnique({
          where: { transactionId },
          include: { refund: { select: { transactionId: true } }, wallet: { select: { studentId: true } } },
        });
        if (!purchase) throw fail('Transaction not found', 404);
        if (purchase.transactionType !== 'purchase') throw fail('Only purchases can be refunded', 422);
        if (purchase.refund) throw fail('This purchase was already refunded', 409);

        // increment (not "set") so a purchase landing at the same moment can't be lost;
        // that purchase's balance guard fails instead and the cashier retries.
        const wallet = await tx.walletAccount.update({
          where: { walletId: purchase.walletId },
          data: { balance: { increment: purchase.amount } },
        });
        const amount = Number(purchase.amount);
        const balanceAfter = Number(wallet.balance);
        const ref = purchase.referenceNo ?? `#${transactionId}`;

        const refund = await tx.walletTransaction.create({
          data: {
            walletId: purchase.walletId,
            shopId: purchase.shopId,
            transactionType: 'refund',
            amount,
            balanceBefore: balanceAfter - amount,
            balanceAfter,
            descriptionEn: `Refund of ${ref}: ${reason}`.slice(0, 255),
            descriptionLo: `ຄືນເງິນ ${ref}: ${reason}`.slice(0, 255),
            referenceNo: `RF-${transactionId}`,
            processedBy,
            refundOfId: transactionId,
          },
        });
        return { refund, studentId: purchase.wallet.studentId, balanceAfter };
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') throw fail('This purchase was already refunded', 409);
      throw err;
    }
  }

  async updateStatus(walletId, status) {
    return prisma.walletAccount.update({
      where: { walletId: parseInt(walletId) },
      data: { status },
    });
  }

  /**
   * IWalletRepository contract — used by ProcessTransaction (shop purchase flow).
   * Returns a Wallet domain entity (not a raw Prisma row) so the use-case can call
   * its business methods (isFrozen/canAfford/deductBalance).
   */
  async findByStudentId(studentId) {
    const wallet = await prisma.walletAccount.findUnique({ where: { studentId: parseInt(studentId) } });
    if (!wallet) return null;
    return new Wallet(wallet);
  }

  /**
   * Atomically applies a balance change and records the transaction.
   * Uses an optimistic-lock (updateMany guarded by the balance we expect to still be
   * current) so two concurrent purchases against the same wallet can't both succeed
   * against a stale balance and silently over-spend it. If the guard fails, the caller
   * should surface a "please retry" error rather than a generic 500.
   */
  async updateBalance(walletId, newBalance, transactionData, expectedBalanceBefore) {
    return prisma.$transaction(async (tx) => {
      const guard = await tx.walletAccount.updateMany({
        where: { walletId: parseInt(walletId), balance: expectedBalanceBefore },
        data: { balance: newBalance },
      });

      if (guard.count === 0) {
        const err = new Error('Wallet balance changed concurrently — please retry the transaction');
        (err as any).statusCode = 409;
        throw err;
      }

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: parseInt(walletId),
          transactionType: transactionData.transactionType,
          amount: transactionData.amount,
          shopId: transactionData.shopId ?? null,
          balanceBefore: transactionData.balanceBefore,
          balanceAfter: transactionData.balanceAfter,
          descriptionEn: transactionData.descriptionEn,
          descriptionLo: transactionData.descriptionLo,
          referenceNo: transactionData.referenceNo,
          processedBy: transactionData.processedBy ? parseInt(transactionData.processedBy) : null,
        },
      });

      const wallet = await tx.walletAccount.findUnique({ where: { walletId: parseInt(walletId) } });
      return { wallet: new Wallet(wallet), transaction };
    });
  }

  /**
   * Sum of 'purchase' transactions on a wallet since a given point in time.
   * Used to enforce daily/weekly spending limits. A refunded purchase was
   * given back, so it no longer counts against the limit.
   */
  async getSpentSince(walletId, since) {
    const result = await prisma.walletTransaction.aggregate({
      where: {
        walletId: parseInt(walletId),
        transactionType: 'purchase',
        refund: { is: null },
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    });
    return Number(result._sum.amount || 0);
  }
}

export default new WalletRepository();
