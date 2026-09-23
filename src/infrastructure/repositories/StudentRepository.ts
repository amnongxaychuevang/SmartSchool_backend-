import prisma from '../database/PrismaClient';

class StudentRepository {
  /**
   * Get paginated list of students with optional search
   */
  async findMany({ search = '', page = 1, limit = 20, status }: any = {}) {
    const skip = (page - 1) * limit;
    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { fullNameEn: { contains: search } },
              { fullNameLo: { contains: search } },
              { studentCode: { contains: search } },
            ],
          }
        : {}),
    };

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          classStudents: {
            include: { class: { select: { classNameEn: true, classNameLo: true } } },
            take: 1,
          },
        },
      }),
      prisma.student.count({ where }),
    ]);

    return { students, total, page, limit };
  }

  async findById(studentId) {
    return prisma.student.findUnique({
      where: { studentId },
      include: {
        classStudents: {
          include: { class: true }
        }
      }
    });
  }

  async create(data) {
    return prisma.student.create({
      data,
      include: {
        classStudents: {
          include: { class: { select: { classNameEn: true, classNameLo: true } } },
          take: 1
        }
      }
    });
  }

  async update(studentId, data) {
    return prisma.student.update({
      where: { studentId: parseInt(studentId) },
      data,
      include: {
        classStudents: {
          include: { class: { select: { classNameEn: true, classNameLo: true } } },
          take: 1
        }
      }
    });
  }

  async delete(studentId) {
    return prisma.student.delete({
      where: { studentId: parseInt(studentId) }
    });
  }
}

export default new StudentRepository();
