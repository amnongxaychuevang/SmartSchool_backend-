import prisma from '../database/PrismaClient';
import dispatcher from '../notifications/NotificationDispatcher';
import { calculateConductScore } from '../../domain/conductScore';
import { teacherClassesWhere } from './AcademicYear';

export class BehaviorRepository {
  async listCategories() {
    return prisma.behaviorCategory.findMany({
      orderBy: [{ type: 'asc' }, { categoryId: 'asc' }],
    });
  }

  async createCategory(data: {
    nameEn: string;
    nameLo: string;
    type: 'merit' | 'demerit';
    defaultPoints?: number;
    severity?: string;
  }) {
    return prisma.behaviorCategory.create({
      data: {
        nameEn: data.nameEn,
        nameLo: data.nameLo,
        type: data.type,
        defaultPoints: data.defaultPoints ?? 5,
        severity: data.severity ?? 'low',
        isActive: true,
      },
    });
  }

  async updateCategory(categoryId: number, data: { nameEn?: string; nameLo?: string; type?: 'merit' | 'demerit'; defaultPoints?: number; severity?: string }) {
    return prisma.behaviorCategory.update({ where: { categoryId }, data });
  }

  // Past records keep their own title and points; only the category link is cleared (onDelete: SetNull).
  async deleteCategory(categoryId: number) {
    return prisma.behaviorCategory.delete({ where: { categoryId } });
  }

  async listRecords(query: {
    studentId?: number;
    classId?: number;
    type?: 'merit' | 'demerit';
    search?: string;
    /** A teacher sees only students currently in the classes they teach or are homeroom teacher of. */
    teacherUserId?: number;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.studentId) where.studentId = query.studentId;
    if (query.type) where.type = query.type;
    if (query.classId || query.teacherUserId) {
      where.student = {
        classStudents: {
          some: {
            ...(query.classId ? { classId: query.classId } : {}),
            ...(query.teacherUserId ? { leftAt: null, class: await teacherClassesWhere(query.teacherUserId) } : {}),
          },
        },
      };
    }
    const q = typeof query.search === 'string' ? query.search.trim() : undefined;
    if (q) {
      where.OR = [
        { titleEn: { contains: q } },
        { titleLo: { contains: q } },
        { description: { contains: q } },
        { student: { fullNameEn: { contains: q } } },
        { student: { fullNameLo: { contains: q } } },
        { student: { studentCode: { contains: q } } },
      ];
    }

    const [total, records] = await Promise.all([
      prisma.behaviorRecord.count({ where }),
      prisma.behaviorRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { incidentDate: 'desc' },
        include: {
          student: {
            select: {
              studentId: true,
              studentCode: true,
              fullNameEn: true,
              fullNameLo: true,
              photoUrl: true,
              classStudents: {
                select: {
                  class: { select: { classId: true, classNameEn: true, classNameLo: true } },
                },
              },
            },
          },
          category: true,
          recorder: {
            select: { userId: true, fullNameEn: true, fullNameLo: true },
          },
        },
      }),
    ]);

    return {
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStudentConduct(studentId: number) {
    const [student, records] = await Promise.all([
      prisma.student.findUnique({
        where: { studentId },
        select: {
          studentId: true,
          studentCode: true,
          fullNameEn: true,
          fullNameLo: true,
          classStudents: {
            select: {
              class: { select: { classId: true, classNameEn: true, classNameLo: true } },
            },
          },
        },
      }),
      prisma.behaviorRecord.findMany({
        where: { studentId },
        orderBy: { incidentDate: 'desc' },
        include: {
          category: true,
          recorder: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
        },
      }),
    ]);

    if (!student) {
      throw Object.assign(new Error('Student not found'), { statusCode: 404 });
    }

    const scoreResult = calculateConductScore(
      records.map((r) => ({ type: r.type, points: r.points }))
    );

    return {
      student,
      summary: scoreResult,
      records,
    };
  }

  async createRecord(
    data: {
      studentId: number;
      categoryId?: number;
      type: 'merit' | 'demerit';
      titleEn: string;
      titleLo: string;
      description?: string;
      points?: number;
      incidentDate?: string | Date;
      actionTaken?: string;
      notifyParent?: boolean;
    },
    recordedBy?: number
  ) {
    const student = await prisma.student.findUnique({
      where: { studentId: data.studentId },
      select: { studentId: true, fullNameEn: true, fullNameLo: true },
    });
    if (!student) {
      throw Object.assign(new Error('Student not found'), { statusCode: 404 });
    }

    const points = data.points ?? 5;
    const record = await prisma.behaviorRecord.create({
      data: {
        studentId: data.studentId,
        categoryId: data.categoryId,
        type: data.type,
        titleEn: data.titleEn,
        titleLo: data.titleLo,
        description: data.description,
        points,
        incidentDate: data.incidentDate ? new Date(data.incidentDate) : new Date(),
        actionTaken: data.actionTaken,
        notifyParent: data.notifyParent ?? true,
        recordedBy,
      },
      include: {
        category: true,
        student: true,
      },
    });

    if (data.notifyParent !== false) {
      const typeLabelEn = data.type === 'merit' ? 'Good conduct record (Merit)' : 'Disciplinary violation (Demerit)';
      const typeLabelLo = data.type === 'merit' ? 'ບັນທຶກຄວາມດີ (ຊົມເຊີຍ)' : 'ບັນທຶກການກະທຳຜິດວິໄນ';
      const ptsSign = data.type === 'merit' ? `+${points}` : `-${points}`;

      const msgEn = `${typeLabelEn}: ${student.fullNameEn} received ${ptsSign} points for "${data.titleEn}". Action: ${data.actionTaken || 'Recorded in profile'}.`;
      const msgLo = `${typeLabelLo}: ນ້ອງ ${student.fullNameLo} ໄດ້ຮັບ ${ptsSign} ຄະແນນ ໃນຫົວຂໍ້ "${data.titleLo}". ມາດຕະການ: ${data.actionTaken || 'ບັນທຶກໄວ້ໃນປະຫວັດ'}.`;

      dispatcher.notifyParents(
        student.studentId,
        'behavior',
        msgEn,
        msgLo
      ).catch((err) => console.error('[Behavior] Parent notification error:', err));
    }

    return record;
  }

  // Corrections to a record; the parent is not notified again.
  async updateRecord(
    recordId: number,
    data: {
      categoryId?: number | null;
      type?: 'merit' | 'demerit';
      titleEn?: string;
      titleLo?: string;
      description?: string;
      points?: number;
      incidentDate?: string;
      actionTaken?: string;
    }
  ) {
    const { incidentDate, ...rest } = data;
    return prisma.behaviorRecord.update({
      where: { recordId },
      data: { ...rest, ...(incidentDate ? { incidentDate: new Date(incidentDate) } : {}) },
      include: { category: true, student: true },
    });
  }

  /** Whether the student is currently in one of the teacher's classes. */
  async teacherHasStudent(teacherUserId: number, studentId: number) {
    const hit = await prisma.classStudent.findFirst({
      where: { studentId, leftAt: null, class: await teacherClassesWhere(teacherUserId) },
      select: { studentId: true },
    });
    return Boolean(hit);
  }

  async findRecord(recordId: number) {
    return prisma.behaviorRecord.findUnique({ where: { recordId }, select: { recordId: true, studentId: true, recordedBy: true } });
  }

  async deleteRecord(recordId: number) {
    return prisma.behaviorRecord.delete({
      where: { recordId },
    });
  }

  async getOverview() {
    const [totalMerits, totalDemerits, totalStudents, recentRecords] = await Promise.all([
      prisma.behaviorRecord.count({ where: { type: 'merit' } }),
      prisma.behaviorRecord.count({ where: { type: 'demerit' } }),
      prisma.student.count({ where: { status: 'active' } }),
      prisma.behaviorRecord.findMany({
        take: 5,
        orderBy: { incidentDate: 'desc' },
        include: {
          student: { select: { studentId: true, fullNameEn: true, fullNameLo: true } },
          category: true,
        },
      }),
    ]);

    return {
      totalRecords: totalMerits + totalDemerits,
      totalMerits,
      totalDemerits,
      totalStudents,
      recentRecords,
    };
  }
}

export default new BehaviorRepository();
