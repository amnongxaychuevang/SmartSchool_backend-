import prisma from '../database/PrismaClient';

class AuditLogRepository {
  /**
   * Records one accountability entry. Never throws — a logging failure must
   * not break the primary action it's observing (wallet purchase, login, ...).
   */
  async log({ userId, action, entityType, entityId, detail, ipAddress }: {
    userId?: number | null;
    action: string;
    entityType: string;
    entityId?: string | number | null;
    detail?: any;
    ipAddress?: string | null;
  }) {
    try {
      return await prisma.auditLog.create({
        data: {
          userId: userId ?? null,
          action: action as any,
          entityType,
          entityId: entityId != null ? String(entityId) : null,
          detail: detail !== undefined ? detail : undefined,
          ipAddress: ipAddress ?? null,
        },
      });
    } catch (err) {
      console.error('[AuditLog] failed to write entry:', err);
      return null;
    }
  }

  async findMany({ userId, entityType, action, excludeAuth = false, page = 1, limit = 50 }: any = {}) {
    const skip = (page - 1) * limit;
    const where = {
      ...(userId ? { userId: parseInt(userId) } : {}),
      ...(entityType ? { entityType } : {}),
      // Sign-in noise (login / failed / logout) would crowd out real changes on the dashboard.
      ...(action ? { action } : excludeAuth ? { action: { notIn: ['login', 'login_failed', 'logout'] as any } } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total, page, limit };
  }
}

export default new AuditLogRepository();
