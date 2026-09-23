import prisma from '../database/PrismaClient';

class ClassRepository {
  async findMany({ search = '', page = 1, limit = 20 }: any = {}) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { classNameEn: { contains: search } },
            { classNameLo: { contains: search } },
            { academicYear: { contains: search } },
          ],
        }
      : {};

    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ academicYear: 'desc' }, { classNameEn: 'asc' }],
        include: {
          homeroomTeacher: {
            select: { userId: true, fullNameEn: true, fullNameLo: true },
          },
          _count: { select: { classStudents: true } },
        },
      }),
      prisma.class.count({ where }),
    ]);

    return { classes, total, page, limit };
  }

  async create(data) {
    return prisma.class.create({
      data: {
        classNameEn: data.classNameEn,
        classNameLo: data.classNameLo,
        gradeLevelEn: data.gradeLevelEn,
        gradeLevelLo: data.gradeLevelLo,
        homeroomTeacherId: data.homeroomTeacherId ? parseInt(data.homeroomTeacherId) : null,
        academicYear: data.academicYear,
        descriptionEn: data.descriptionEn,
        descriptionLo: data.descriptionLo,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      include: {
        homeroomTeacher: {
          select: { userId: true, fullNameEn: true, fullNameLo: true },
        },
        _count: { select: { classStudents: true } },
      },
    });
  }

  async update(classId, data) {
    return prisma.class.update({
      where: { classId: parseInt(classId) },
      data: {
        classNameEn: data.classNameEn,
        classNameLo: data.classNameLo,
        gradeLevelEn: data.gradeLevelEn,
        gradeLevelLo: data.gradeLevelLo,
        homeroomTeacherId: data.homeroomTeacherId !== undefined ? (data.homeroomTeacherId ? parseInt(data.homeroomTeacherId) : null) : undefined,
        academicYear: data.academicYear,
        descriptionEn: data.descriptionEn,
        descriptionLo: data.descriptionLo,
        isActive: data.isActive,
      },
      include: {
        homeroomTeacher: {
          select: { userId: true, fullNameEn: true, fullNameLo: true },
        },
        _count: { select: { classStudents: true } },
      },
    });
  }

  async delete(classId) {
    return prisma.class.delete({
      where: { classId: parseInt(classId) }
    });
  }
}

export default new ClassRepository();
