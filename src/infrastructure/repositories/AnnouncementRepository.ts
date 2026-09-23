import { PrismaClient  } from '@prisma/client';
const prisma = new PrismaClient();

class AnnouncementRepository {
  async findAll() {
    return prisma.announcement.findMany({
      orderBy: { publishDate: 'desc' },
      include: { author: { select: { fullNameEn: true, fullNameLo: true } } }
    });
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
