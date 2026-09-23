import prisma from '../database/PrismaClient';

class ShopRepository {
  async findMany({ search = '', page = 1, limit = 20 }: any = {}) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { shopNameEn: { contains: search } },
            { shopNameLo: { contains: search } },
          ],
        }
      : {};

    const [shops, total] = await Promise.all([
      prisma.shop.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.shop.count({ where }),
    ]);

    return { shops, total, page, limit };
  }

  async findById(shopId) {
    return prisma.shop.findUnique({ where: { shopId: parseInt(shopId) } });
  }

  async create(data) {
    return prisma.shop.create({ data });
  }

  async update(shopId, data) {
    return prisma.shop.update({
      where: { shopId: parseInt(shopId) },
      data,
    });
  }

  async delete(shopId) {
    return prisma.shop.delete({ where: { shopId: parseInt(shopId) } });
  }
}

export default new ShopRepository();
