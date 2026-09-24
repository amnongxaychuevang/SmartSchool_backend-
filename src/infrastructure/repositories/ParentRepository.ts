import prisma from '../database/PrismaClient';
import { currentEnrolmentWhere } from './AcademicYear';
import { scheduleInclude, flattenSchedule } from './ScheduleRepository';

class ParentRepository {
  /**
   * List parents with user info, optional search
   */
  async findMany({ search = '', page = 1, limit = 20 }: any = {}) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { user: { fullNameEn: { contains: search } } },
            { user: { fullNameLo: { contains: search } } },
            { user: { email: { contains: search } } },
            { user: { phoneNumber: { contains: search } } },
          ],
        }
      : {};

    const [parents, total] = await Promise.all([
      prisma.parent.findMany({
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
      prisma.parent.count({ where }),
    ]);

    return { parents, total, page, limit };
  }

  async findById(parentId) {
    return prisma.parent.findUnique({
      where: { parentId: parseInt(parentId) },
      include: { user: true },
    });
  }

  async create(userData, parentData) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { ...userData, role: { connect: { code: 'parent' } } } });
      const parent = await tx.parent.create({
        data: { ...parentData, userId: user.userId },
        include: {
          user: {
            select: {
              userId: true, fullNameEn: true, fullNameLo: true,
              email: true, phoneNumber: true, isActive: true, lastLogin: true,
            },
          },
        },
      });
      return parent;
    });
  }

  async update(parentId, userData, parentData) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.parent.findUnique({ where: { parentId: parseInt(parentId) } });
      if (!existing) throw new Error('Parent not found');

      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { userId: existing.userId }, data: userData });
      }

      return tx.parent.update({
        where: { parentId: parseInt(parentId) },
        data: parentData,
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

  async findMyChildren(parentUserId) {
    const parentStudents = await prisma.parentStudent.findMany({
      where: { parentUserId: parseInt(parentUserId) },
      include: {
        student: true,
      }
    });
    // Extract students from the pivot table
    return parentStudents.map(ps => ps.student);
  }

  async findChildAttendance(studentId, parentUserId) {
    const link = await prisma.parentStudent.findUnique({
      where: { uq_parent_student: { parentUserId: parseInt(parentUserId), studentId: parseInt(studentId) } }
    });
    if (!link) {
      throw Object.assign(new Error('Unauthorized or not your child'), { statusCode: 403 });
    }

    return prisma.attendanceLog.findMany({
      where: { studentId: parseInt(studentId) },
      orderBy: { logTime: 'desc' },
      take: 100 // Limit for frontend performance
    });
  }

  async findChildGrades(studentId, parentUserId) {
    const link = await prisma.parentStudent.findUnique({
      where: { uq_parent_student: { parentUserId: parseInt(parentUserId), studentId: parseInt(studentId) } }
    });
    if (!link) {
      throw Object.assign(new Error('Unauthorized or not your child'), { statusCode: 403 });
    }

    const grades = await prisma.grade.findMany({
      where: { studentId: parseInt(studentId) },
      include: {
        classSubject: { include: { subject: true, class: true, term: true } },
      },
      orderBy: { recordedAt: 'desc' }
    });
    return grades.map(({ classSubject, ...g }) => ({
      ...g,
      // `subject.class` kept for the existing parent grades screen.
      subject: { ...classSubject.subject, class: classSubject.class },
      term: classSubject.term,
    }));
  }

  async findChildWallet(studentId, parentUserId) {
    const link = await prisma.parentStudent.findUnique({
      where: { uq_parent_student: { parentUserId: parseInt(parentUserId), studentId: parseInt(studentId) } }
    });
    if (!link) {
      throw Object.assign(new Error('Unauthorized or not your child'), { statusCode: 403 });
    }

    return prisma.walletAccount.findUnique({
      where: { studentId: parseInt(studentId) },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });
  }
  async getAnnouncements(parentUserId) {
    // Classes the parent's children are in this year, for class-targeted announcements.
    const enrolments = await prisma.classStudent.findMany({
      where: {
        ...(await currentEnrolmentWhere()),
        student: { parentStudents: { some: { parentUserId: parseInt(parentUserId) } } },
      },
      select: { classId: true },
    });
    const classIds = enrolments.map((e) => e.classId);

    return prisma.announcement.findMany({
      where: {
        AND: [
          {
            OR: [
              { targetAudience: { in: ['all', 'parents'] } },
              { targetAudience: 'class', classId: { in: classIds } },
            ],
          },
          { OR: [{ expiryDate: null }, { expiryDate: { gte: new Date() } }] },
        ],
      },
      orderBy: { publishDate: 'desc' }
    });
  }

  async getChildSchedule(studentId, parentUserId) {
    const link = await prisma.parentStudent.findUnique({
      where: { uq_parent_student: { parentUserId: parseInt(parentUserId), studentId: parseInt(studentId) } }
    });
    if (!link) throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });

    const studentClasses = await prisma.classStudent.findMany({
      where: { studentId: parseInt(studentId), ...(await currentEnrolmentWhere()) },
      select: { classId: true }
    });
    const classIds = studentClasses.map(sc => sc.classId);

    const rows = await prisma.schedule.findMany({
      where: { classSubject: { classId: { in: classIds } } },
      include: scheduleInclude,
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' }
      ]
    });
    return rows.map(flattenSchedule);
  }

  async getLeaveRequests(studentId, parentUserId) {
    const link = await prisma.parentStudent.findUnique({
      where: { uq_parent_student: { parentUserId: parseInt(parentUserId), studentId: parseInt(studentId) } }
    });
    if (!link) throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });

    return prisma.leaveRequest.findMany({
      where: { studentId: parseInt(studentId) },
      orderBy: { requestedAt: 'desc' }
    });
  }

  async createLeaveRequest(studentId, parentUserId, data) {
    const link = await prisma.parentStudent.findUnique({
      where: { uq_parent_student: { parentUserId: parseInt(parentUserId), studentId: parseInt(studentId) } }
    });
    if (!link) throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });

    return prisma.leaveRequest.create({
      data: {
        studentId: parseInt(studentId),
        parentUserId: parseInt(parentUserId),
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
        documentUrl: data.documentUrl,
        status: 'pending'
      }
    });
  }

  async getSpendingLimits(studentId, parentUserId) {
    const link = await prisma.parentStudent.findUnique({
      where: { uq_parent_student: { parentUserId: parseInt(parentUserId), studentId: parseInt(studentId) } }
    });
    if (!link) throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });

    return prisma.spendingLimit.findUnique({
      where: { studentId: parseInt(studentId) }
    });
  }

  async updateSpendingLimits(studentId, parentUserId, data) {
    const link = await prisma.parentStudent.findUnique({
      where: { uq_parent_student: { parentUserId: parseInt(parentUserId), studentId: parseInt(studentId) } }
    });
    if (!link) throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });

    return prisma.spendingLimit.upsert({
      where: { studentId: parseInt(studentId) },
      update: {
        dailyMax: data.dailyMax ? parseFloat(data.dailyMax) : null,
        weeklyMax: data.weeklyMax ? parseFloat(data.weeklyMax) : null,
        perTransactionMax: data.perTransactionMax ? parseFloat(data.perTransactionMax) : null,
        alertThreshold: data.alertThreshold ? parseFloat(data.alertThreshold) : null,
        setBy: parseInt(parentUserId)
      },
      create: {
        studentId: parseInt(studentId),
        dailyMax: data.dailyMax ? parseFloat(data.dailyMax) : null,
        weeklyMax: data.weeklyMax ? parseFloat(data.weeklyMax) : null,
        perTransactionMax: data.perTransactionMax ? parseFloat(data.perTransactionMax) : null,
        alertThreshold: data.alertThreshold ? parseFloat(data.alertThreshold) : null,
        setBy: parseInt(parentUserId)
      }
    });
  }
}

export default new ParentRepository();
