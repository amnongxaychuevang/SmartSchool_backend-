import prisma from '../database/PrismaClient';
import dispatcher from '../notifications/NotificationDispatcher';
import { calculateConductScore } from '../../domain/conductScore';

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

  async listRecords(query: {
    studentId?: number;
    classId?: number;
    type?: 'merit' | 'demerit';
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.studentId) where.studentId = query.studentId;
    if (query.type) where.type = query.type;
    if (query.classId) {
      where.student = {
        classStudents: {
          some: { classId: query.classId },
        },
      };
    }
    if (query.search) {
      where.OR = [
        { titleEn: { contains: query.search } },
        { titleLo: { contains: query.search } },
        { student: { fullNameEn: { contains: query.search } } },
        { student: { fullNameLo: { contains: query.search } } },
        { student: { studentCode: { contains: query.search } } },
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
                  class: { select: { classId: true, nameEn: true, nameLo: true } },
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
              class: { select: { classId: true, nameEn: true, nameLo: true } },
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
