import prisma from '../database/PrismaClient';

class CardRepository {
  async findMany({ studentId, status, page = 1, limit = 20 }: any = {}) {
    const skip = (page - 1) * limit;
    const where = {
      ...(studentId ? { studentId: parseInt(studentId) } : {}),
      ...(status ? { status } : {}),
    };

    const [cards, total] = await Promise.all([
      prisma.card.findMany({
        where,
        skip,
        take: limit,
        orderBy: { issuedDate: 'desc' },
        include: {
          student: {
            select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true },
          },
          issuer: {
            select: { userId: true, fullNameEn: true, fullNameLo: true },
          },
        },
      }),
      prisma.card.count({ where }),
    ]);

    return { cards, total, page, limit };
  }

  async findByCardUid(cardUid) {
    return prisma.card.findUnique({
      where: { cardUid },
      include: {
        student: true,
      },
    });
  }

  /**
   * ICardRepository contract — used by the attendance scan use-case.
   * Returns the minimal shape the use-case needs, or null if the card doesn't exist.
   */
  async findByUid(cardUid) {
    const card = await prisma.card.findUnique({ where: { cardUid } });
    if (!card) return null;
    return { cardId: card.cardId, studentId: card.studentId, status: card.status };
  }

  async create(data) {
    return prisma.card.create({
      data,
      include: {
        student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } },
        issuer: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
      },
    });
  }

  async update(cardId, data) {
    return prisma.card.update({
      where: { cardId: parseInt(cardId) },
      data,
      include: {
        student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } },
        issuer: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
      },
    });
  }

  async delete(cardId) {
    return prisma.card.delete({ where: { cardId: parseInt(cardId) } });
  }
}

export default new CardRepository();
