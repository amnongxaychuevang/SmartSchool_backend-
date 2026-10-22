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
    const overlap = await prisma.teacherLeave.findFirst({
      where: { teacherUserId, status: { in: ['pending', 'approved'] }, startDate: { lte: endDate }, endDate: { gte: startDate } },
      select: { leaveId: true },
    });
    if (overlap) throw fail('You already have a leave request covering these dates', 409);
    const leave = await prisma.teacherLeave.create({
      data: { teacherUserId, leaveType: input.leaveType, startDate, endDate, reason: input.reason || null },
      include,
    });
    this.notifyAdmins(leave).catch((err) => console.error('[TeacherLeave] Admin notification error:', err));
    return leave;
  }

  private async notifyAdmins(leave: any) {
    try {
      const admins = await prisma.user.findMany({
        where: {
          OR: [
            { role: { code: 'admin' } },
            { role: { portal: 'admin' } },
          ],
        },
        select: { userId: true },
      });

      const teacherUser = leave.teacher?.user;
      const teacherName = teacherUser ? (teacherUser.fullNameLo || teacherUser.fullNameEn) : 'ຄູ';
      const start = leave.startDate instanceof Date ? leave.startDate.toISOString().slice(0, 10) : leave.startDate;
      const end = leave.endDate instanceof Date ? leave.endDate.toISOString().slice(0, 10) : leave.endDate;

      const typeLabels: Record<string, string> = {
        sick: 'ລາປ່ວຍ',
        personal: 'ລາກິດ',
        annual: 'ລາພັກປະຈຳປີ',
        maternity: 'ລາເກີດລູກ',
        other: 'ອື່ນໆ',
      };
      const typeLo = typeLabels[leave.leaveType] || leave.leaveType;

      for (const a of admins) {
        await prisma.notification.create({
          data: {
            recipientUserId: a.userId,
            type: 'general',
            channel: 'app_push',
            titleLo: 'ຄຳຂໍລາພັກໃໝ່ຈາກຄູ',
            titleEn: 'New Teacher Leave Request',
            messageLo: `ຄູ ${teacherName} ໄດ້ສົ່ງຄຳຂໍລາພັກ (${typeLo}) ວັນທີ ${start} ຫາ ${end}`,
            messageEn: `Teacher ${teacherName} submitted a leave request (${leave.leaveType}) from ${start} to ${end}`,
            link: '/admin/teacher-leaves',
          },
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[TeacherLeave] Failed to notify admins:', err);
    }
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
    const updated = await prisma.teacherLeave.findUnique({ where: { leaveId }, include });
    if (updated) {
      this.notifyTeacher(updated, note).catch((err) => console.error('[TeacherLeave] Teacher notification error:', err));
    }
    return updated;
  }

  private async notifyTeacher(leave: any, note?: string | null) {
    try {
      const isApproved = leave.status === 'approved';
      const decider = leave.decider;
      const deciderName = decider ? (decider.fullNameLo || decider.fullNameEn) : 'ຜູ້ບໍລິຫານ';
      const start = leave.startDate instanceof Date ? leave.startDate.toISOString().slice(0, 10) : leave.startDate;
      const end = leave.endDate instanceof Date ? leave.endDate.toISOString().slice(0, 10) : leave.endDate;

      await prisma.notification.create({
        data: {
          recipientUserId: leave.teacherUserId,
          type: 'general',
          channel: 'app_push',
          titleLo: isApproved ? 'ຄຳຂໍລາພັກໄດ້ຮັບການອະນຸມັດ' : 'ຄຳຂໍລາພັກຖືກປະຕິເສດ',
          titleEn: isApproved ? 'Leave Request Approved' : 'Leave Request Rejected',
          messageLo: `ຄຳຂໍລາພັກວັນທີ ${start} ຫາ ${end} ໄດ້ຮັບການ${isApproved ? 'ອະນຸມັດ' : 'ປະຕິເສດ'}ແລ້ວ ໂດຍ ${deciderName}${note ? ` (ໝາຍເຫດ: ${note})` : ''}`,
          messageEn: `Your leave request (${start} to ${end}) was ${leave.status} by ${deciderName}${note ? ` (Note: ${note})` : ''}`,
          link: '/teacher/my-leave',
        },
      });
    } catch (err) {
      console.error('[TeacherLeave] Failed to notify teacher:', err);
    }
  }
}

export default new TeacherLeaveRepository();
