import prisma from '../database/PrismaClient';
import { formatSummerStudentCode, getSummerPaymentStatus } from '../../domain/summer';

export interface CreateCourseInput {
  academicYear: string;
  subjectNameEn: string;
  subjectNameLo: string;
  gradeLevel?: string | null;
  monthlyFee: number;
  teacherName?: string | null;
  roomNumber?: string | null;
  timeSlot?: string | null;
  description?: string | null;
  isActive?: boolean;
}

export interface RegisterStudentInput {
  fullNameEn: string;
  fullNameLo: string;
  gender?: string;
  dateOfBirth?: string | null;
  parentName: string;
  phoneNumber: string;
  academicYear: string;
  monthsEnrolled: number[]; // [1, 2, 3]
  courseIds: number[];
  paymentMethod?: string;
  paidAmount?: number;
  notes?: string | null;
  recordedBy?: number;
}

class SummerRepository {
  // ─── Courses ───────────────────────────────────────────────
  async listCourses(academicYear?: string, includeInactive = false) {
    const where: any = {};
    if (academicYear) where.academicYear = academicYear;
    if (!includeInactive) where.isActive = true;

    return prisma.summerCourse.findMany({
      where,
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: [{ isActive: 'desc' }, { courseId: 'asc' }],
    });
  }

  async getCourseById(courseId: number) {
    return prisma.summerCourse.findUnique({
      where: { courseId },
    });
  }

  async createCourse(data: CreateCourseInput) {
    return prisma.summerCourse.create({
      data: {
        academicYear: data.academicYear,
        subjectNameEn: data.subjectNameEn,
        subjectNameLo: data.subjectNameLo,
        gradeLevel: data.gradeLevel ?? null,
        monthlyFee: data.monthlyFee,
        teacherName: data.teacherName ?? null,
        roomNumber: data.roomNumber ?? null,
        timeSlot: data.timeSlot ?? null,
        description: data.description ?? null,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateCourse(courseId: number, data: Partial<CreateCourseInput>) {
    return prisma.summerCourse.update({
      where: { courseId },
      data: {
        ...(data.academicYear && { academicYear: data.academicYear }),
        ...(data.subjectNameEn && { subjectNameEn: data.subjectNameEn }),
        ...(data.subjectNameLo && { subjectNameLo: data.subjectNameLo }),
        ...(data.gradeLevel !== undefined && { gradeLevel: data.gradeLevel }),
        ...(data.monthlyFee !== undefined && { monthlyFee: data.monthlyFee }),
        ...(data.teacherName !== undefined && { teacherName: data.teacherName }),
        ...(data.roomNumber !== undefined && { roomNumber: data.roomNumber }),
        ...(data.timeSlot !== undefined && { timeSlot: data.timeSlot }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async deleteCourse(courseId: number) {
    return prisma.summerCourse.delete({
      where: { courseId },
    });
  }

  // ─── Registrations ─────────────────────────────────────────
  async generateStudentCode(academicYear: string): Promise<string> {
    const yearShort = academicYear.slice(-2); // e.g. "26" from "2025-2026"
    const prefix = `SM-${yearShort}`;
    const count = await prisma.summerStudent.count({
      where: {
        studentCode: { startsWith: prefix },
      },
    });
    return formatSummerStudentCode(yearShort, count + 1);
  }

  async registerStudent(input: RegisterStudentInput) {
    const courses = await prisma.summerCourse.findMany({
      where: {
        courseId: { in: input.courseIds },
      },
    });

    if (courses.length === 0) {
      throw new Error('No valid summer courses selected');
    }

    const uniqueMonths = Array.from(new Set(input.monthsEnrolled)).sort((a, b) => a - b);
    if (uniqueMonths.length === 0) {
      throw new Error('At least one month must be selected');
    }

    // Calculate total amount = sum of monthly fees for selected courses * number of months
    const monthlyTotal = courses.reduce((sum, c) => sum + Number(c.monthlyFee), 0);
    const totalAmount = monthlyTotal * uniqueMonths.length;
    const paidAmount = input.paidAmount !== undefined ? input.paidAmount : totalAmount;

    // Transaction
    return prisma.$transaction(async (tx) => {
      // 1. Find or create SummerStudent by phone & full name
      let student = await tx.summerStudent.findFirst({
        where: {
          phoneNumber: input.phoneNumber,
          fullNameLo: input.fullNameLo,
        },
      });

      if (!student) {
        const studentCode = await this.generateStudentCode(input.academicYear);
        student = await tx.summerStudent.create({
          data: {
            studentCode,
            fullNameEn: input.fullNameEn,
            fullNameLo: input.fullNameLo,
            gender: input.gender ?? null,
            dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
            parentName: input.parentName,
            phoneNumber: input.phoneNumber,
            notes: input.notes ?? null,
          },
        });
      }

      // 2. Generate RegNo and ReceiptNo
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const regNo = `REG-SM-${dateStr}-${randomSuffix}`;
      const receiptNo = `REC-SM-${dateStr}-${randomSuffix}`;

      // 3. Create Registration
      const registration = await tx.summerRegistration.create({
        data: {
          regNo,
          studentId: student.studentId,
          academicYear: input.academicYear,
          monthsEnrolled: uniqueMonths,
          totalAmount,
          paidAmount,
          paymentMethod: input.paymentMethod || 'cash',
          paymentStatus: getSummerPaymentStatus(totalAmount, paidAmount),
          receiptNo,
          paidAt: now,
          notes: input.notes ?? null,
          recordedBy: input.recordedBy ?? null,
          items: {
            create: uniqueMonths.flatMap((month) =>
              courses.map((course) => ({
                courseId: course.courseId,
                monthNumber: month,
                courseFee: course.monthlyFee,
              }))
            ),
          },
        },
        include: {
          student: true,
          items: {
            include: {
              course: true,
            },
          },
        },
      });

      return registration;
    });
  }

  async listRegistrations(params: {
    academicYear?: string;
    month?: number;
    search?: string;
    paymentStatus?: string;
    page?: number;
    limit?: number;
  }) {
    const { academicYear, month, search, paymentStatus, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (academicYear) where.academicYear = academicYear;
    if (paymentStatus) where.paymentStatus = paymentStatus;

    if (search) {
      where.OR = [
        { regNo: { contains: search } },
        { receiptNo: { contains: search } },
        { student: { fullNameLo: { contains: search } } },
        { student: { fullNameEn: { contains: search } } },
        { student: { studentCode: { contains: search } } },
        { student: { phoneNumber: { contains: search } } },
      ];
    }

    if (month) {
      where.items = {
        some: { monthNumber: month },
      };
    }

    const [total, registrations] = await Promise.all([
      prisma.summerRegistration.count({ where }),
      prisma.summerRegistration.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: true,
          items: {
            include: {
              course: true,
            },
          },
          recorder: {
            select: {
              userId: true,
              fullNameLo: true,
              fullNameEn: true,
            },
          },
        },
      }),
    ]);

    return {
      data: registrations,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRegistrationById(registrationId: number) {
    return prisma.summerRegistration.findUnique({
      where: { registrationId },
      include: {
        student: true,
        items: {
          include: {
            course: true,
          },
        },
        recorder: {
          select: {
            userId: true,
            fullNameLo: true,
            fullNameEn: true,
          },
        },
      },
    });
  }

  async getStats(academicYear?: string) {
    const where: any = {};
    if (academicYear) where.academicYear = academicYear;

    const registrations = await prisma.summerRegistration.findMany({
      where,
      select: {
        registrationId: true,
        studentId: true,
        totalAmount: true,
        paidAmount: true,
        paymentStatus: true,
        monthsEnrolled: true,
        items: {
          select: {
            monthNumber: true,
            courseId: true,
            courseFee: true,
            course: {
              select: {
                subjectNameLo: true,
                subjectNameEn: true,
              },
            },
          },
        },
      },
    });

    const totalStudents = new Set(registrations.map((r) => r.studentId)).size;
    const totalRegistrations = registrations.length;
    const totalRevenue = registrations.reduce((sum, r) => sum + Number(r.paidAmount), 0);

    // Month breakdown
    const monthCounts = { month1: 0, month2: 0, month3: 0 };
    const monthRevenues = { month1: 0, month2: 0, month3: 0 };

    // Course breakdown
    const courseStats: Record<string, { nameLo: string; nameEn: string; count: number; revenue: number }> = {};

    for (const reg of registrations) {
      const months = Array.isArray(reg.monthsEnrolled) ? (reg.monthsEnrolled as number[]) : [];
      if (months.includes(1)) monthCounts.month1++;
      if (months.includes(2)) monthCounts.month2++;
      if (months.includes(3)) monthCounts.month3++;

      for (const item of reg.items) {
        const fee = Number(item.courseFee);
        if (item.monthNumber === 1) monthRevenues.month1 += fee;
        if (item.monthNumber === 2) monthRevenues.month2 += fee;
        if (item.monthNumber === 3) monthRevenues.month3 += fee;

        const key = String(item.courseId);
        if (!courseStats[key]) {
          courseStats[key] = {
            nameLo: item.course.subjectNameLo,
            nameEn: item.course.subjectNameEn,
            count: 0,
            revenue: 0,
          };
        }
        courseStats[key].count++;
        courseStats[key].revenue += fee;
      }
    }

    return {
      totalStudents,
      totalRegistrations,
      totalRevenue,
      monthCounts,
      monthRevenues,
      courseStats: Object.values(courseStats),
    };
  }
}

export default new SummerRepository();
