import prisma from '../database/PrismaClient';

class AnnouncementRepository {
  async findAll({ page = 1, limit = 10, search = '' } = {}) {
    const skip = (page - 1) * limit;
    const where = search ? {
      OR: [
        { titleEn: { contains: search } },
        { titleLo: { contains: search } },
        { contentEn: { contains: search } },
        { contentLo: { contains: search } },
      ]
    } : {};

    const [data, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishDate: 'desc' },
        include: {
          author: { select: { fullNameEn: true, fullNameLo: true } },
          class: { select: { classNameEn: true, classNameLo: true } },
        }
      }),
      prisma.announcement.count({ where })
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id) {
    return prisma.announcement.findUnique({
      where: { announcementId: parseInt(id) },
      include: { author: { select: { fullNameEn: true, fullNameLo: true } } }
    });
  }

  async create(data) {
    return prisma.announcement.create({
      data
    });
  }

  async update(id, data) {
    return prisma.announcement.update({
      where: { announcementId: parseInt(id) },
      data
    });
  }

  async delete(id) {
    return prisma.announcement.delete({
      where: { announcementId: parseInt(id) }
    });
  }
}

export default new AnnouncementRepository();
