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
    return prisma.$transaction(async (tx) => {
      const req = await tx.topUpRequest.findUnique({ where: { requestId: parseInt(requestId) } });
      if (!req) throw new Error('Top-up request not found');
      if (req.status !== 'pending') throw new Error('Request is not pending');

      // Find or create wallet for student
      let wallet = await tx.walletAccount.findUnique({ where: { studentId: req.studentId } });
      if (!wallet) {
        wallet = await tx.walletAccount.create({ data: { studentId: req.studentId, balance: 0 } });
      }

      const balanceBefore = Number(wallet.balance);
      const balanceAfter = balanceBefore + Number(req.amount);

      // Update wallet
      await tx.walletAccount.update({
        where: { walletId: wallet.walletId },
        data: { balance: balanceAfter },
      });

      // Create transaction record
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.walletId,
          transactionType: 'top_up',
          amount: Number(req.amount),
          balanceBefore,
          balanceAfter,
          descriptionEn: `Top-up approved (request #${requestId})`,
          descriptionLo: `ຍອມຮັບການເຕີມເງິນ (#${requestId})`,
          processedBy: parseInt(approvedBy),
          referenceNo: `TU-REQ-${requestId}-${Date.now()}`,
        },
      });

      // Mark request as approved
      return tx.topUpRequest.update({
        where: { requestId: parseInt(requestId) },
        data: {
          status: 'approved',
          approvedBy: parseInt(approvedBy),
          processedAt: new Date(),
        },
        include: {
          student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } },
        },
      });
    });
  }

  async reject(requestId, approvedBy, rejectReasonEn = '', rejectReasonLo = '') {
    const req = await prisma.topUpRequest.findUnique({ where: { requestId: parseInt(requestId) } });
    if (!req) throw new Error('Top-up request not found');
    if (req.status !== 'pending') throw new Error('Request is not pending');

    return prisma.topUpRequest.update({
      where: { requestId: parseInt(requestId) },
      data: {
        status: 'rejected',
        approvedBy: parseInt(approvedBy),
        rejectReasonEn,
        rejectReasonLo,
        processedAt: new Date(),
      },
    });
  }
}

export default new TopUpRepository();
