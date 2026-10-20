import prisma from '../database/PrismaClient';
import { teacherClassesWhere } from './AcademicYear';

const httpError = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

// What every class row carries: the homeroom teacher and how many students are in it now.
const CLASS_INCLUDE = {
  homeroomTeacher: {
    select: { userId: true, fullNameEn: true, fullNameLo: true, avatarUrl: true },
  },
  _count: {
    select: {
      classStudents: { where: { leftAt: null } },
      classSubjects: { where: { term: { status: 'active' as const } } },
    },
  },
};

class ClassRepository {
  async findMany({ search = '', page = 1, limit = 20, teacherUserId, academicYear, status }: any = {}) {
    const skip = (page - 1) * limit;
    const where = {
      AND: [
        search
          ? {
              OR: [
                { classNameEn: { contains: search } },
                { classNameLo: { contains: search } },
                { gradeLevelEn: { contains: search } },
                { gradeLevelLo: { contains: search } },
              ],
            }
          : {},
        academicYear ? { academicYear } : {},
        // Teachers only see their own classes.
        teacherUserId ? await teacherClassesWhere(teacherUserId) : {},
      ],
    };

    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ academicYear: 'desc' }, { classNameEn: 'asc' }],
        include: CLASS_INCLUDE,
      }),
      prisma.class.count({ where }),
    ]);

    return { classes, total, page, limit };
  }

  async findAll(teacherUserId?: number) {
    const where = teacherUserId ? await teacherClassesWhere(teacherUserId) : {};
    const classes = await prisma.class.findMany({
      where,
      orderBy: [{ academicYear: 'desc' }, { classNameEn: 'asc' }],
      select: {
        classId: true,
        classNameEn: true,
        classNameLo: true,
        academicYear: true,
      },
    });
    return classes;
  }

  /** One class with who's in it now and what it studies this term. */
  async findById(classId) {
    const id = parseInt(classId);
    if (!Number.isInteger(id)) return null;
    return prisma.class.findUnique({
      where: { classId: id },
      include: {
        ...CLASS_INCLUDE,
        classStudents: {
          where: { leftAt: null },
          select: {
            student: {
              select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true, gender: true, photoUrl: true, status: true },
            },
          },
          orderBy: { student: { fullNameLo: 'asc' } },
        },
        classSubjects: {
          where: { term: { status: 'active' } },
          select: {
            id: true,
            subject: { select: { subjectId: true, subjectNameEn: true, subjectNameLo: true, subjectCode: true } },
            teacher: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
          },
          orderBy: { subject: { subjectNameEn: 'asc' } },
        },
      },
    });
  }

  /** Every academic year used by a class or a term, newest first — for the year filter and picker. */
  async findAcademicYears() {
    const [fromClasses, fromTerms] = await Promise.all([
      prisma.class.findMany({ distinct: ['academicYear'], select: { academicYear: true } }),
      prisma.academicTerm.findMany({ distinct: ['academicYear'], select: { academicYear: true } }),
    ]);
    return [...new Set([...fromClasses, ...fromTerms].map((r) => r.academicYear))].sort().reverse();
  }

  /** The homeroom teacher must be an active teacher; the name must be free in that year. */
  private async check(data, classId?: number) {
    if (data.homeroomTeacherId) {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: data.homeroomTeacherId },
        select: { user: { select: { isActive: true } } },
      });
      if (!teacher || !teacher.user.isActive) throw httpError('The homeroom teacher must be an active teacher', 400);
    }

    if (data.classNameEn !== undefined || data.classNameLo !== undefined || data.academicYear !== undefined) {
      const current = classId
        ? await prisma.class.findUnique({ where: { classId }, select: { classNameEn: true, classNameLo: true, academicYear: true } })
        : null;
      const academicYear = data.academicYear ?? current?.academicYear;
      const names = [data.classNameEn ?? current?.classNameEn, data.classNameLo ?? current?.classNameLo].filter(Boolean);
      const clash = await prisma.class.findFirst({
        where: {
          academicYear,
          OR: [{ classNameEn: { in: names } }, { classNameLo: { in: names } }],
          ...(classId ? { NOT: { classId } } : {}),
        },
        select: { classId: true },
      });
      if (clash) throw httpError(`A class with this name already exists in ${academicYear}`, 409);
    }
  }

  async create(data) {
    await this.check(data);
    return prisma.class.create({
      data: {
        classNameEn: data.classNameEn,
        classNameLo: data.classNameLo,
        gradeLevelEn: data.gradeLevelEn,
        gradeLevelLo: data.gradeLevelLo,
        homeroomTeacherId: data.homeroomTeacherId ?? null,
        academicYear: data.academicYear,
      },
      include: CLASS_INCLUDE,
    });
  }

  async update(classId, data) {
    const id = parseInt(classId);
    const exists = await prisma.class.findUnique({ where: { classId: id }, select: { classId: true } });
    if (!exists) throw httpError('Class not found', 404);
    await this.check(data, id);
    return prisma.class.update({
      where: { classId: id },
      data: {
        classNameEn: data.classNameEn,
        classNameLo: data.classNameLo,
        gradeLevelEn: data.gradeLevelEn,
        gradeLevelLo: data.gradeLevelLo,
        homeroomTeacherId: data.homeroomTeacherId,
        academicYear: data.academicYear,
      },
      include: CLASS_INCLUDE,
    });
  }

  /**
   * Deleting a class would cascade to its enrolments, subjects, grades and schedules,
   * so only a class that was never used can be deleted; otherwise deactivate it.
   */
  async delete(classId) {
    const id = parseInt(classId);
    const cls = await prisma.class.findUnique({
      where: { classId: id },
      select: { _count: { select: { classStudents: true, classSubjects: true, announcements: true, feeStructures: true } } },
    });
    if (!cls) throw httpError('Class not found', 404);
    const { classStudents, classSubjects, announcements, feeStructures } = cls._count;
    const used = classStudents + classSubjects + announcements + feeStructures > 0;
    if (used) throw httpError('This class already has students, subjects, fees or announcements. Deactivate it instead of deleting.', 409);
    return prisma.class.delete({ where: { classId: id } });
  }
}

export default new ClassRepository();
