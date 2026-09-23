import prisma from '../database/PrismaClient';

class UserAdminRepository {
  /**
   * List users with optional role filter and search
   */
  async findMany({ role, search = '', page = 1, limit = 20 }: any = {}) {
    const skip = (page - 1) * limit;
    const where = {
      ...(role ? { role: { code: role } } : {}),
      ...(search
        ? {
            OR: [
              { fullNameEn: { contains: search } },
              { fullNameLo: { contains: search } },
              { email: { contains: search } },
              { phoneNumber: { contains: search } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          userId: true,
          fullNameEn: true,
          fullNameLo: true,
          email: true,
          phoneNumber: true,
          role: {
            select: {
              roleId: true,
              code: true,
              nameEn: true,
              nameLo: true
            }
          },
          langPref: true,
          avatarUrl: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page, limit };
  }

  async findById(userId) {
    return prisma.user.findUnique({
      where: { userId: parseInt(userId) }
    });
  }

  async create(data) {
    return prisma.user.create({
      data,
      select: {
        userId: true,
        fullNameEn: true,
        fullNameLo: true,
        email: true,
        phoneNumber: true,
        role: { select: { roleId: true, code: true, nameEn: true, nameLo: true } },
        langPref: true,
        avatarUrl: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      }
    });
  }

  async update(userId, data) {
    return prisma.user.update({
      where: { userId: parseInt(userId) },
      data,
      select: {
        userId: true,
        fullNameEn: true,
        fullNameLo: true,
        email: true,
        phoneNumber: true,
        role: { select: { roleId: true, code: true, nameEn: true, nameLo: true } },
        langPref: true,
        avatarUrl: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      }
    });
  }

  async delete(userId) {
    return prisma.user.delete({
      where: { userId: parseInt(userId) }
    });
  }
}

export default new UserAdminRepository();
