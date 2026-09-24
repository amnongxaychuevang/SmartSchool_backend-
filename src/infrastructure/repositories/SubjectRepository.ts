import prisma from '../database/PrismaClient';

class SubjectRepository {
  async findMany({ search = '', classId, teacherId, page = 1, limit = 20 }: any = {}) {
    const skip = (page - 1) * limit;
    const where = {
      // "Subjects taught to this class / by this teacher" go through ClassSubject.
      ...(classId || teacherId
        ? {
            classSubjects: {
              some: {
                ...(classId ? { classId: parseInt(classId) } : {}),
                ...(teacherId ? { teacherId: parseInt(teacherId) } : {}),
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { subjectNameEn: { contains: search } },
              { subjectNameLo: { contains: search } },
              { subjectCode: { contains: search } },
            ],
          }
        : {}),
    };

    const [subjects, total] = await Promise.all([
      prisma.subject.findMany({
        where,
        skip,
        take: limit,
        orderBy: { subjectNameEn: 'asc' },
      }),
      prisma.subject.count({ where }),
    ]);

    return { subjects, total, page, limit };
  }

  async findById(subjectId) {
    return prisma.subject.findUnique({
      where: { subjectId: parseInt(subjectId) },
    });
  }

  async create(data) {
    return prisma.subject.create({
      data,
    });
  }

  async update(subjectId, data) {
    return prisma.subject.update({
      where: { subjectId: parseInt(subjectId) },
      data,
    });
  }

  async delete(subjectId) {
    return prisma.subject.delete({ where: { subjectId: parseInt(subjectId) } });
  }
}

export default new SubjectRepository();
