import prisma from '../database/PrismaClient';

class GradeRepository {
  async findMany({ studentId, subjectId, classId, gradeMonth, page = 1, limit = 30 }: any = {}) {
    const skip = (page - 1) * limit;
    const where = {
      ...(studentId ? { studentId: parseInt(studentId) } : {}),
      ...(subjectId ? { subjectId: parseInt(subjectId) } : {}),
      ...(gradeMonth ? { gradeMonth } : {}),
      ...(classId
        ? { subject: { classId: parseInt(classId) } }
        : {}),
    };

    const [grades, total] = await Promise.all([
      prisma.grade.findMany({
        where,
        skip,
        take: limit,
        orderBy: { recordedAt: 'desc' },
        include: {
          student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } },
          subject: { select: { subjectId: true, subjectNameEn: true, subjectNameLo: true } },
          teacher: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
          gradeType: { select: { typeId: true, typeNameEn: true, typeNameLo: true } },
        },
      }),
      prisma.grade.count({ where }),
    ]);

    return { grades, total, page, limit };
  }

  async findGradeTypes() {
    return prisma.gradeType.findMany({ orderBy: { typeNameEn: 'asc' } });
  }

  async create(data) {
    return prisma.grade.create({
      data,
      include: {
        student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } },
        subject: { select: { subjectId: true, subjectNameEn: true, subjectNameLo: true } },
        teacher: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
        gradeType: { select: { typeId: true, typeNameEn: true, typeNameLo: true } },
      },
    });
  }

  async update(gradeId, data) {
    return prisma.grade.update({
      where: { gradeId: parseInt(gradeId) },
      data,
      include: {
        student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } },
        subject: { select: { subjectId: true, subjectNameEn: true, subjectNameLo: true } },
        teacher: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
        gradeType: { select: { typeId: true, typeNameEn: true, typeNameLo: true } },
      },
    });
  }

  async delete(gradeId) {
    return prisma.grade.delete({ where: { gradeId: parseInt(gradeId) } });
  }
}

export default new GradeRepository();
