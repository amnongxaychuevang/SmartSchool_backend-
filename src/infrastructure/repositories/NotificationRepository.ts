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

  async markDelivered(notificationId: number | string) {
    return prisma.notification.update({
      where: { notificationId: parseInt(notificationId as string) },
      data: { status: 'sent', deliveredAt: new Date() },
    });
  }

  async findUserNotifications(userId: number, { unreadOnly = false, page = 1, limit = 20 }: any = {}) {
    const skip = (page - 1) * limit;
    const where: any = {
      recipientUserId: userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: 'desc' },
        include: {
          student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } },
        },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { recipientUserId: userId, isRead: false } }),
    ]);

    return { notifications, total, unreadCount, page, limit };
  }

  async getUnreadCount(userId: number) {
    return prisma.notification.count({
      where: { recipientUserId: userId, isRead: false },
    });
  }

  async markAsRead(notificationId: number, userId: number) {
    return prisma.notification.updateMany({
      where: { notificationId, recipientUserId: userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: number) {
    return prisma.notification.updateMany({
      where: { recipientUserId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}

export default new NotificationRepository();
