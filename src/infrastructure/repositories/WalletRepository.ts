import prisma from '../database/PrismaClient';
import Wallet from '../../domain/entities/Wallet';

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
            select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true },
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
   * Used to enforce daily/weekly spending limits.
   */
  async getSpentSince(walletId, since) {
    const result = await prisma.walletTransaction.aggregate({
      where: {
        walletId: parseInt(walletId),
        transactionType: 'purchase',
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    });
    return Number(result._sum.amount || 0);
  }
}

export default new WalletRepository();
