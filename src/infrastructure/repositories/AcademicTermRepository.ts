import prisma from '../database/PrismaClient';

/**
 * Only one term may be active at a time: new class subjects and grades go into it.
 * Activating a term moves any other active term to "upcoming" (if it starts later)
 * or "completed" (if it started earlier).
 */
async function deactivateOthers(tx, termId: number, startDate: Date) {
  const others = await tx.academicTerm.findMany({ where: { status: 'active', termId: { not: termId } } });
  for (const t of others) {
    await tx.academicTerm.update({
      where: { termId: t.termId },
      data: { status: t.startDate > startDate ? 'upcoming' : 'completed' },
    });
  }
}

class AcademicTermRepository {
  async create(data) {
    return prisma.$transaction(async (tx) => {
      const term = await tx.academicTerm.create({ data });
      if (term.status === 'active') await deactivateOthers(tx, term.termId, term.startDate);
      return term;
    });
  }

  async findMany(filters = {}) {
    return prisma.academicTerm.findMany({ where: filters, orderBy: { startDate: 'desc' } });
  }

  async findById(termId) {
    return prisma.academicTerm.findUnique({ where: { termId: parseInt(termId) } });
  }

  async update(termId, data) {
    return prisma.$transaction(async (tx) => {
      const term = await tx.academicTerm.update({ where: { termId: parseInt(termId) }, data });
      if (term.status === 'active') await deactivateOthers(tx, term.termId, term.startDate);
      return term;
    });
  }

  async delete(termId) {
    return prisma.academicTerm.delete({
      where: { termId: parseInt(termId) },
    });
  }
}

export default new AcademicTermRepository();
