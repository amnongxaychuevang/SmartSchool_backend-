import { Prisma } from '@prisma/client';
import prisma from '../database/PrismaClient';
import { schoolDateValue } from '../../domain/schoolTime';

export interface TeacherLeaveInput {
  leaveType: 'sick' | 'personal' | 'annual' | 'maternity' | 'other';
  startDate: string;
  endDate: string;
  reason?: string | null;
}

const include = {
  teacher: {
    select: {
      employeeCode: true,
      user: { select: { userId: true, fullNameEn: true, fullNameLo: true, phoneNumber: true, avatarUrl: true } },
    },
  },
  decider: { select: { fullNameEn: true, fullNameLo: true } },
} satisfies Prisma.TeacherLeaveInclude;

const fail = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

class TeacherLeaveRepository {
  async listMine(teacherUserId: number) {
    return prisma.teacherLeave.findMany({ where: { teacherUserId }, orderBy: { startDate: 'desc' }, include });
  }

  async create(teacherUserId: number, input: TeacherLeaveInput) {
    const startDate = schoolDateValue(input.startDate);
    const endDate = schoolDateValue(input.endDate);
    if (endDate < startDate) throw fail('The end date is before the start date', 400);
    // No two live requests may cover the same day.
    const overlap = await prisma.teacherLeave.findFirst({
      where: { teacherUserId, status: { in: ['pending', 'approved'] }, startDate: { lte: endDate }, endDate: { gte: startDate } },
      select: { leaveId: true },
    });
    if (overlap) throw fail('You already have a leave request covering these dates', 409);
    return prisma.teacherLeave.create({
      data: { teacherUserId, leaveType: input.leaveType, startDate, endDate, reason: input.reason || null },
      include,
    });
  }

  /** A teacher may withdraw their own request while it is still pending. */
  async cancel(teacherUserId: number, leaveId: number) {
    const removed = await prisma.teacherLeave.deleteMany({ where: { leaveId, teacherUserId, status: 'pending' } });
    if (!removed.count) throw fail('Only your own pending requests can be cancelled', 409);
  }

  async list(query: { status?: string; search?: string; page: number; limit: number }) {
    const where: Prisma.TeacherLeaveWhereInput = {
      ...(query.status === 'pending' || query.status === 'approved' || query.status === 'rejected' ? { status: query.status } : {}),
      ...(query.search
        ? {
            teacher: {
              OR: [
                { employeeCode: { contains: query.search } },
                { user: { fullNameEn: { contains: query.search } } },
                { user: { fullNameLo: { contains: query.search } } },
              ],
            },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.teacherLeave.findMany({
        where,
        include,
        orderBy: [{ requestedAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.teacherLeave.count({ where }),
    ]);
    return { data, meta: { total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) } };
  }

  /** Approve or reject, once: a decided request cannot be flipped. */
  async decide(leaveId: number, status: 'approved' | 'rejected', decidedBy: number, note?: string | null) {
    const claimed = await prisma.teacherLeave.updateMany({
      where: { leaveId, status: 'pending' },
      data: { status, decidedBy, decisionNote: note || null, decidedAt: new Date() },
    });
    if (!claimed.count) {
      const exists = await prisma.teacherLeave.findUnique({ where: { leaveId }, select: { leaveId: true } });
      throw exists ? fail('This request has already been decided', 409) : fail('Leave request not found', 404);
    }
    return prisma.teacherLeave.findUnique({ where: { leaveId }, include });
  }
}

export default new TeacherLeaveRepository();
