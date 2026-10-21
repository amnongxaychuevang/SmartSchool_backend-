import prisma from '../database/PrismaClient';

class PasswordResetRepository {
  /** Stores a new code for the user; any earlier unused code stops working. */
  async create(userId: number, codeHash: string, expiresAt: Date) {
    return prisma.$transaction(async (tx) => {
      await tx.passwordResetCode.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
      return tx.passwordResetCode.create({ data: { userId, codeHash, expiresAt } });
    });
  }

  /** The user's current code, if it is unused and not expired. */
  async findActive(userId: number) {
    return prisma.passwordResetCode.findFirst({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async countSince(userId: number, since: Date) {
    return prisma.passwordResetCode.count({ where: { userId, createdAt: { gte: since } } });
  }

  async addAttempt(id: number) {
    return prisma.passwordResetCode.update({ where: { id }, data: { attempts: { increment: 1 } } });
  }

  async markUsed(id: number) {
    return prisma.passwordResetCode.update({ where: { id }, data: { usedAt: new Date() } });
  }
}

export default new PasswordResetRepository();
