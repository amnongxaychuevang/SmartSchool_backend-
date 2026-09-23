import { PrismaClient  } from '@prisma/client';
const prisma = new PrismaClient();

class AcademicTermRepository {
  async create(data) {
    return prisma.academicTerm.create({ data });
  }

  async findMany(filters = {}) {
    return prisma.academicTerm.findMany({ where: filters, orderBy: { startDate: 'desc' } });
  }

  async findById(termId) {
    return prisma.academicTerm.findUnique({ where: { termId: parseInt(termId) } });
  }

  async update(termId, data) {
    return prisma.academicTerm.update({
      where: { termId: parseInt(termId) },
      data,
    });
  }

  async delete(termId) {
    return prisma.academicTerm.delete({
      where: { termId: parseInt(termId) },
    });
  }
}

export default new AcademicTermRepository();
