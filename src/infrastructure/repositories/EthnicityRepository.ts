import prisma from '../database/PrismaClient';

class EthnicityRepository {
  async findAll() {
    return prisma.ethnicity.findMany({
      select: { ethnicityId: true, code: true, nameLo: true, nameEn: true },
      orderBy: [{ sortOrder: 'asc' }, { ethnicityId: 'asc' }],
    });
  }
}

export default new EthnicityRepository();
