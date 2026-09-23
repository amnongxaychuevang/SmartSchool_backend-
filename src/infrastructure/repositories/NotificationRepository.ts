import prisma from '../database/PrismaClient';

class NotificationRepository {
  async findMany({ recipientUserId, studentId, status, page = 1, limit = 30 }: any = {}) {
    const skip = (page - 1) * limit;
    const where = {
      ...(recipientUserId ? { recipientUserId: parseInt(recipientUserId) } : {}),
      ...(studentId ? { studentId: parseInt(studentId) } : {}),
      ...(status ? { status } : {}),
    };

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: 'desc' },
        include: {
          recipient: { select: { userId: true, fullNameEn: true, fullNameLo: true, role: true } },
          student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } },
        },
      }),
      prisma.notification.count({ where }),
    ]);

    return { notifications, total, page, limit };
  }

  async create(data) {
    return prisma.notification.create({
      data,
      include: {
        recipient: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
        student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } },
      },
    });
  }

  async markDelivered(notificationId) {
    return prisma.notification.update({
      where: { notificationId: parseInt(notificationId) },
      data: { status: 'sent', deliveredAt: new Date() },
    });
  }
}

export default new NotificationRepository();
