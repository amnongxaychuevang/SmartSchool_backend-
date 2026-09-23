import prisma from '../database/PrismaClient';

class TeacherRepository {
  /**
   * List teachers with user info, optional search
   */
  async findMany({ search = '', page = 1, limit = 20 }: any = {}) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { employeeCode: { contains: search } },
            { user: { fullNameEn: { contains: search } } },
            { user: { fullNameLo: { contains: search } } },
            { user: { email: { contains: search } } },
          ],
        }
      : {};

    const [teachers, total] = await Promise.all([
      prisma.teacher.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              userId: true,
              fullNameEn: true,
              fullNameLo: true,
              email: true,
              phoneNumber: true,
              isActive: true,
              lastLogin: true,
            },
          },
        },
      }),
      prisma.teacher.count({ where }),
    ]);

    return { teachers, total, page, limit };
  }

  async findById(teacherId) {
    return prisma.teacher.findUnique({
      where: { teacherId: parseInt(teacherId) },
      include: { user: true },
    });
  }

  async generateNextEmployeeCode(tx?: any) {
    const client = tx || prisma;
    const lastTeacher = await client.teacher.findFirst({
      where: {
        employeeCode: {
          startsWith: 'TCH-',
        },
      },
      orderBy: {
        teacherId: 'desc',
      },
      select: {
        employeeCode: true,
      },
    });

    let nextNumber = 1;
    if (lastTeacher?.employeeCode) {
      const match = lastTeacher.employeeCode.match(/TCH-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    let candidate = `TCH-${String(nextNumber).padStart(4, '0')}`;
    while (await client.teacher.findUnique({ where: { employeeCode: candidate } })) {
      nextNumber++;
      candidate = `TCH-${String(nextNumber).padStart(4, '0')}`;
    }

    return candidate;
  }

  async create(userData, teacherData) {
    // Create User + Teacher in one transaction
    return prisma.$transaction(async (tx) => {
      let employeeCode = teacherData.employeeCode;
      if (!employeeCode || String(employeeCode).trim() === '') {
        employeeCode = await this.generateNextEmployeeCode(tx);
      }

      const user = await tx.user.create({ data: { ...userData, role: { connect: { code: 'teacher' } } } });
      const teacher = await tx.teacher.create({
        data: { ...teacherData, employeeCode, userId: user.userId },
        include: {
          user: {
            select: {
              userId: true, fullNameEn: true, fullNameLo: true,
              email: true, phoneNumber: true, isActive: true, lastLogin: true,
            },
          },
        },
      });
      return teacher;
    });
  }

  async update(teacherId, userData, teacherData) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.teacher.findUnique({ where: { teacherId: parseInt(teacherId) } });
      if (!existing) throw new Error('Teacher not found');

      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { userId: existing.userId }, data: userData });
      }

      return tx.teacher.update({
        where: { teacherId: parseInt(teacherId) },
        data: teacherData,
        include: {
          user: {
            select: {
              userId: true, fullNameEn: true, fullNameLo: true,
              email: true, phoneNumber: true, isActive: true, lastLogin: true,
            },
          },
        },
      });
    });
  }

  async delete(teacherId) {
    // Deleting teacher also deletes user (cascade set on teacher.userId → user)
    const teacher = await prisma.teacher.findUnique({ where: { teacherId: parseInt(teacherId) } });
    if (!teacher) throw new Error('Teacher not found');
    // Delete user → cascades to teacher
    return prisma.user.delete({ where: { userId: teacher.userId } });
  }
}

export default new TeacherRepository();
