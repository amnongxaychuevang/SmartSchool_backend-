import prisma from '../database/PrismaClient';
import { currentEnrolmentWhere } from './AcademicYear';

class StudentRepository {
  /**
   * Get paginated list of students with optional search
   */
  async findMany({ search = '', page = 1, limit = 20, status, classId }: any = {}) {
    const skip = (page - 1) * limit;
    const where = {
      ...(status ? { status } : {}),
      ...(classId
        ? { classStudents: { some: { classId: parseInt(classId), ...(await currentEnrolmentWhere()) } } }
        : {}),
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

    const enrolment = await currentEnrolmentWhere();
    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          // Only this year's class; [0] used to be whichever enrolment came first (possibly last year's).
          classStudents: {
            where: enrolment,
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
          where: await currentEnrolmentWhere(),
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
          where: await currentEnrolmentWhere(),
          include: { class: { select: { classNameEn: true, classNameLo: true } } },
          take: 1
        }
      }
    });
  }
}

export default new StudentRepository();
