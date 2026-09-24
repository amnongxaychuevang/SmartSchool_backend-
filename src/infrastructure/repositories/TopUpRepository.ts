import prisma from '../database/PrismaClient';

class TopUpRepository {
  async findMany({ status, studentId, parentUserId, page = 1, limit = 20 }: any = {}) {
    const skip = (page - 1) * limit;
    const where = {
      ...(status ? { status } : {}),
      ...(studentId ? { studentId: parseInt(studentId) } : {}),
      // Scopes results to a single parent's own requests — callers acting as 'parent'
      // must always pass this so they can't browse other families' top-up history.
      ...(parentUserId ? { parentUserId: parseInt(parentUserId) } : {}),
    };

    const [requests, total] = await Promise.all([
      prisma.topUpRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { requestedAt: 'desc' },
        include: {
          student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } },
          parentRequester: { select: { userId: true, fullNameEn: true, fullNameLo: true, phoneNumber: true } },
          approver: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
        },
      }),
      prisma.topUpRequest.count({ where }),
    ]);

    return { requests, total, page, limit };
  }

  async create(data) {
    if (!(Number(data.amount) > 0)) {
      throw Object.assign(new Error('Amount must be a positive number'), { statusCode: 400 });
    }

    // A parent may only request a top-up for their own child — verify the link
    // before creating the request (previously any logged-in parent could submit
    // a request against any studentId).
    const link = await prisma.parentStudent.findUnique({
      where: {
        uq_parent_student: {
          parentUserId: parseInt(data.parentUserId),
          studentId: parseInt(data.studentId),
        },
      },
    });
    if (!link) {
      throw Object.assign(new Error('Unauthorized or not your child'), { statusCode: 403 });
    }

    return prisma.topUpRequest.create({
      data,
      include: {
        student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } },
        parentRequester: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
      },
    });
  }

  async approve(requestId, approvedBy) {
    const id = parseInt(requestId);
    const approverId = parseInt(approvedBy);

    return prisma.$transaction(async (tx) => {
      // Claim the request first. The conditional UPDATE row-locks it, so if two
      // admins approve at once the second one waits, then matches 0 rows —
      // the top-up can never be credited twice.
      const claimed = await tx.topUpRequest.updateMany({
        where: { requestId: id, status: 'pending' },
        data: { status: 'approved', approvedBy: approverId, processedAt: new Date() },
      });
      if (claimed.count === 0) await this.throwNotPending(tx, id);

      const req = await tx.topUpRequest.findUniqueOrThrow({ where: { requestId: id } });
      const amount = Number(req.amount);

      // Find or create wallet for student
      let wallet = await tx.walletAccount.findUnique({ where: { studentId: req.studentId } });
      if (!wallet) {
        wallet = await tx.walletAccount.create({ data: { studentId: req.studentId, balance: 0 } });
      }

      // Atomic increment instead of read-modify-write, so a purchase that lands
      // while this runs is not overwritten. balanceBefore is derived from the
      // post-increment value, which is exact because the row is locked.
      const updated = await tx.walletAccount.update({
        where: { walletId: wallet.walletId },
        data: { balance: { increment: amount } },
      });
      const balanceAfter = Number(updated.balance);
      const balanceBefore = balanceAfter - amount;

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.walletId,
          transactionType: 'top_up',
          amount,
          balanceBefore,
          balanceAfter,
          descriptionEn: `Top-up approved (request #${id})`,
          descriptionLo: `ຍອມຮັບການເຕີມເງິນ (#${id})`,
          processedBy: approverId,
          referenceNo: `TU-REQ-${id}-${Date.now()}`,
        },
      });

      // Link the request to the transaction it produced, for auditing.
      return tx.topUpRequest.update({
        where: { requestId: id },
        data: { transactionId: transaction.transactionId },
        include: {
          student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } },
        },
      });
    });
  }

  async reject(requestId, approvedBy, rejectReason = '') {
    const id = parseInt(requestId);

    return prisma.$transaction(async (tx) => {
      const claimed = await tx.topUpRequest.updateMany({
        where: { requestId: id, status: 'pending' },
        data: {
          status: 'rejected',
          approvedBy: parseInt(approvedBy),
          rejectReason,
          processedAt: new Date(),
        },
      });
      if (claimed.count === 0) await this.throwNotPending(tx, id);

      return tx.topUpRequest.findUniqueOrThrow({ where: { requestId: id } });
    });
  }

  private async throwNotPending(tx, requestId: number): Promise<never> {
    const exists = await tx.topUpRequest.findUnique({ where: { requestId }, select: { requestId: true } });
    if (!exists) throw Object.assign(new Error('Top-up request not found'), { statusCode: 404 });
    throw Object.assign(new Error('Request is not pending'), { statusCode: 409 });
  }
}

export default new TopUpRepository();
