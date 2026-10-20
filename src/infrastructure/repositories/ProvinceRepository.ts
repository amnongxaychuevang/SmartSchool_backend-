import prisma from '../database/PrismaClient';

class ProvinceRepository {
  /** Every province with its districts nested — the full list is small (18 / 148). */
  async findAllWithDistricts() {
    return prisma.province.findMany({
      select: {
        provinceId: true,
        nameLo: true,
        nameEn: true,
        districts: {
          select: { districtId: true, nameLo: true, nameEn: true },
          orderBy: { districtId: 'asc' },
        },
      },
      orderBy: { provinceId: 'asc' },
    });
  }
}

export default new ProvinceRepository();
