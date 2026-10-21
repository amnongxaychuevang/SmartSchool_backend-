import prisma from '../database/PrismaClient';
import { ADDRESS_INCLUDE, checkAddress } from './Address';

// Never select the whole user row: it holds the password hash.
const USER_SELECT = {
  userId: true, fullNameEn: true, fullNameLo: true, email: true,
  phoneNumber: true, avatarUrl: true, isActive: true, lastLogin: true,
  passwordHash: true, // only read to compute hasAccount, stripped by withAccount()
} as const;

/** Replaces the password hash with a hasAccount flag before anything leaves the repository. */
function withAccount<T extends { user: { passwordHash: string | null } }>(teacher: T | null) {
  if (!teacher) return teacher;
  const { passwordHash, ...user } = teacher.user;
  return { ...teacher, user, hasAccount: Boolean(passwordHash) };
}

class TeacherRepository {
  /**
   * List teachers with user info; optional search, active/inactive and gender filters.
   */
  /** The list filters as a Prisma where — used by the list and its export. */
  listWhere({ search = '', status, gender }: any = {}) {
    return {
      ...(status === 'active' || status === 'inactive' ? { user: { isActive: status === 'active' } } : {}),
      ...(gender ? { gender } : {}),
      ...(search
        ? {
            OR: [
              { employeeCode: { contains: search } },
              { user: { fullNameEn: { contains: search } } },
              { user: { fullNameLo: { contains: search } } },
              { user: { email: { contains: search } } },
              { user: { phoneNumber: { contains: search } } },
            ],
          }
        : {}),
    };
  }

  async findMany({ search = '', page = 1, limit = 20, status, gender }: any = {}) {
    const skip = (page - 1) * limit;
    const where = this.listWhere({ search, status, gender });

    const [teachers, total] = await Promise.all([
      prisma.teacher.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        // Only what the list and pickers show — salary, bank, address and notes stay on
        // the single-teacher API (anyone with teachers.view can read this list).
        select: {
          teacherId: true,
          userId: true,
          employeeCode: true,
          gender: true,
          specialization: true,
          qualification: true,
          hireDate: true,
          village: true,
          ...ADDRESS_INCLUDE,
          user: { select: USER_SELECT },
        },
      }),
      prisma.teacher.count({ where }),
    ]);

    return { teachers: teachers.map(withAccount), total, page, limit };
  }

  async findById(teacherId) {
    return withAccount(await prisma.teacher.findUnique({
      where: { teacherId: parseInt(teacherId) },
      include: { user: { select: USER_SELECT }, ...ADDRESS_INCLUDE },
    }));
  }

  /** Every active teacher, just enough to pick one from a list (no pagination). */
  async findOptions() {
    const teachers = await prisma.teacher.findMany({
      where: { user: { isActive: true } },
      select: {
        employeeCode: true,
        user: { select: { userId: true, fullNameEn: true, fullNameLo: true, avatarUrl: true } },
      },
      orderBy: { user: { fullNameLo: 'asc' } },
    });
    return teachers.map(({ employeeCode, user }) => ({ ...user, employeeCode }));
  }

  /** Active teachers that have no login account yet — for the Users page. */
  async findWithoutAccount() {
    return prisma.teacher.findMany({
      where: { user: { passwordHash: null, isActive: true } },
      select: {
        teacherId: true,
        employeeCode: true,
        specialization: true,
        user: { select: { userId: true, fullNameEn: true, fullNameLo: true, phoneNumber: true, email: true, avatarUrl: true } },
      },
      orderBy: { employeeCode: 'asc' },
    });
  }

  async setPhoto(userId: number, avatarUrl: string | null) {
    await prisma.user.update({ where: { userId }, data: { avatarUrl } });
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
      await checkAddress(tx, teacherData);
      let employeeCode = teacherData.employeeCode;
      if (!employeeCode || String(employeeCode).trim() === '') {
        employeeCode = await this.generateNextEmployeeCode(tx);
      }

      const user = await tx.user.create({ data: { ...userData, role: { connect: { code: 'teacher' } } } });
      const teacher = await tx.teacher.create({
        data: { ...teacherData, employeeCode, userId: user.userId },
        include: { user: { select: USER_SELECT } },
      });
      return withAccount(teacher);
    });
  }

  async update(teacherId, userData, teacherData) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.teacher.findUnique({ where: { teacherId: parseInt(teacherId) } });
      if (!existing) throw Object.assign(new Error('Teacher not found'), { statusCode: 404 });
      await checkAddress(tx, teacherData, async () => existing.districtId);

      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { userId: existing.userId }, data: userData });
      }

      return withAccount(await tx.teacher.update({
        where: { teacherId: parseInt(teacherId) },
        data: teacherData,
        include: { user: { select: USER_SELECT } },
      }));
    });
  }

}

export default new TeacherRepository();
