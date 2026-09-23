import prisma from '../database/PrismaClient';

class SpendingLimitRepository {
  async findByStudent(studentId) {
    return prisma.spendingLimit.findUnique({
      where: { studentId: parseInt(studentId) },
      include: {
        student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } },
        setter: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
      },
    });
  }

  async upsert(studentId, data, setBy) {
    return prisma.spendingLimit.upsert({
      where: { studentId: parseInt(studentId) },
      create: {
        studentId: parseInt(studentId),
        setBy: parseInt(setBy),
        ...data,
      },
      update: {
        setBy: parseInt(setBy),
        ...data,
      },
      include: {
        student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } },
        setter: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
      },
    });
  }
}

export default new SpendingLimitRepository();
