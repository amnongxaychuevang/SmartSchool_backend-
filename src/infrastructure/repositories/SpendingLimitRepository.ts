import prisma from '../database/PrismaClient';

const include = {
  student: {
    select: {
      studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true,
      blockedShops: { select: { shopId: true } },
    },
  },
  setter: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
};

// Flattens the BlockedShop rows back to the `blockedShops: number[]` the API has always
// returned, so callers (and ProcessTransaction's check) don't change.
function withBlockedShops(limit) {
  if (!limit) return limit;
  const { blockedShops, ...student } = limit.student;
  return { ...limit, student, blockedShops: blockedShops.map((b) => b.shopId) };
}

class SpendingLimitRepository {
  async findByStudent(studentId) {
    const limit = await prisma.spendingLimit.findUnique({
      where: { studentId: parseInt(studentId) },
      include,
    });
    return withBlockedShops(limit);
  }

  async upsert(studentId, data, setBy) {
    const id = parseInt(studentId);
    const { blockedShops, ...limitData } = data;

    const limit = await prisma.$transaction(async (tx) => {
      if (blockedShops !== undefined) {
        await tx.blockedShop.deleteMany({ where: { studentId: id } });
        if (blockedShops.length > 0) {
          await tx.blockedShop.createMany({
            data: [...new Set<number>(blockedShops)].map((shopId) => ({ studentId: id, shopId })),
          });
        }
      }
      return tx.spendingLimit.upsert({
        where: { studentId: id },
        create: { studentId: id, setBy: parseInt(setBy), ...limitData },
        update: { setBy: parseInt(setBy), ...limitData },
        include,
      });
    });
    return withBlockedShops(limit);
  }
}

export default new SpendingLimitRepository();
