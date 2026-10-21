import prisma from '../database/PrismaClient';
import { currentEnrolmentWhere } from './AcademicYear';
import { scheduleInclude, flattenSchedule } from './ScheduleRepository';
import { ADDRESS_INCLUDE, checkAddress } from './Address';
import { schoolDateString } from '../../domain/schoolTime';

// Never select the whole user row: it holds the password hash.
const USER_SELECT = {
  userId: true, fullNameEn: true, fullNameLo: true, email: true,
  phoneNumber: true, avatarUrl: true, isActive: true, lastLogin: true,
} as const;

// The children linked to a parent (from the student form), for the list and the summary card.
const CHILDREN_SELECT = {
  select: {
    relationship: true,
    isPrimaryContact: true,
    student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true, photoUrl: true, status: true } },
  },
  orderBy: { studentId: 'asc' },
} as const;

class ParentRepository {
  /**
   * List parents with user info; optional search and active/inactive filter.
   */
  async findMany({ search = '', page = 1, limit = 20, status }: any = {}) {
    const skip = (page - 1) * limit;
    const where = {
      ...(status === 'active' || status === 'inactive' ? { user: { isActive: status === 'active' } } : {}),
      ...(search
        ? {
            OR: [
              { user: { fullNameEn: { contains: search } } },
              { user: { fullNameLo: { contains: search } } },
              { user: { email: { contains: search } } },
              { user: { phoneNumber: { contains: search } } },
            ],
          }
        : {}),
    };

    const [parents, total] = await Promise.all([
      prisma.parent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        // Only what the list shows — the national ID stays on the single-parent API.
        select: {
          parentId: true,
          userId: true,
          occupation: true,
          village: true,
          address: true,
          emergencyContact: true,
          ...ADDRESS_INCLUDE,
          user: { select: USER_SELECT },
          studentLinks: CHILDREN_SELECT,
        },
      }),
      prisma.parent.count({ where }),
    ]);

    return { parents, total, page, limit };
  }

  /** Every active parent, just enough to pick one from a list (no pagination). */
  async findOptions() {
    const users = await prisma.user.findMany({
      where: { isActive: true, parent: { isNot: null } },
      select: { userId: true, fullNameEn: true, fullNameLo: true, phoneNumber: true },
      orderBy: { fullNameLo: 'asc' },
    });
    return users;
  }

  async findById(parentId) {
    const id = parseInt(parentId);
    if (!Number.isInteger(id)) return null;
    return prisma.parent.findUnique({
      where: { parentId: id },
      include: { user: { select: USER_SELECT }, ...ADDRESS_INCLUDE, studentLinks: CHILDREN_SELECT },
    });
  }

  async setPhoto(userId: number, avatarUrl: string | null) {
    await prisma.user.update({ where: { userId }, data: { avatarUrl } });
  }

  async create(userData, parentData) {
    return prisma.$transaction(async (tx) => {
      await checkAddress(tx, parentData);
      const user = await tx.user.create({ data: { ...userData, role: { connect: { code: 'parent' } } } });
      return tx.parent.create({
        data: { ...parentData, userId: user.userId },
        include: { user: { select: USER_SELECT }, ...ADDRESS_INCLUDE, studentLinks: CHILDREN_SELECT },
      });
    });
  }

  async update(parentId, userData, parentData) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.parent.findUnique({ where: { parentId: parseInt(parentId) } });
      if (!existing) throw Object.assign(new Error('Parent not found'), { statusCode: 404 });
      await checkAddress(tx, parentData, async () => existing.districtId);

      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { userId: existing.userId }, data: userData });
      }

      return tx.parent.update({
        where: { parentId: parseInt(parentId) },
        data: parentData,
        include: { user: { select: USER_SELECT }, ...ADDRESS_INCLUDE, studentLinks: CHILDREN_SELECT },
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

    // Daily status (present / late / absent / excused) rather than raw gate taps —
    // that's what the parent screen shows.
    return prisma.dailyAttendance.findMany({
      where: { studentId: parseInt(studentId) },
      orderBy: { date: 'desc' },
      take: 100,
      select: { id: true, date: true, status: true, firstCheckIn: true, note: true },
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
          take: 20,
          include: {
            shop: { select: { shopId: true, shopNameEn: true, shopNameLo: true } },
            refund: { select: { transactionId: true, createdAt: true } },
          },
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

  // The child's cards, newest first — so a parent can see which one to report lost.
  async getChildCards(studentId, parentUserId) {
    const link = await prisma.parentStudent.findUnique({
      where: { uq_parent_student: { parentUserId: parseInt(parentUserId), studentId: parseInt(studentId) } }
    });
    if (!link) throw Object.assign(new Error('Unauthorized or not your child'), { statusCode: 403 });

    return prisma.card.findMany({
      where: { studentId: parseInt(studentId) },
      orderBy: { issuedDate: 'desc' },
      select: { cardId: true, cardUid: true, status: true, issuedDate: true, expiredDate: true, notes: true },
    });
  }

  /**
   * A parent blocks a lost card at once, so nobody can spend the wallet with it
   * or tap in with it. Only the school can issue a new card or re-activate one.
   */
  async reportCardLost(studentId, cardId, parentUserId) {
    const link = await prisma.parentStudent.findUnique({
      where: { uq_parent_student: { parentUserId: parseInt(parentUserId), studentId: parseInt(studentId) } }
    });
    if (!link) throw Object.assign(new Error('Unauthorized or not your child'), { statusCode: 403 });

    const card = await prisma.card.findFirst({ where: { cardId: parseInt(cardId), studentId: parseInt(studentId) } });
    if (!card) throw Object.assign(new Error('Card not found'), { statusCode: 404 });
    if (card.status !== 'active') throw Object.assign(new Error(`Card is already ${card.status}`), { statusCode: 409 });

    // Keep the school's own note; add the report after it.
    const report = `Reported lost by parent on ${schoolDateString(new Date())}`;
    return prisma.card.update({
      where: { cardId: card.cardId },
      data: { status: 'lost', notes: (card.notes ? `${card.notes} · ${report}` : report).slice(0, 255) },
      select: { cardId: true, cardUid: true, status: true, issuedDate: true, expiredDate: true, notes: true },
    });
  }
}

export default new ParentRepository();
