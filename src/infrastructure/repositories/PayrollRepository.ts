import prisma from '../database/PrismaClient';
import { calculateNetSalary, formatPeriodName, getMonthDateRange } from '../../domain/payroll';

class PayrollRepository {
  async listPeriods({ page = 1, limit = 20 }: { page?: number; limit?: number } = {}) {
    const skip = (page - 1) * limit;
    const [periods, total] = await Promise.all([
      prisma.payrollPeriod.findMany({
        skip,
        take: limit,
        orderBy: { periodMonth: 'desc' },
        include: {
          _count: {
            select: { items: true },
          },
        },
      }),
      prisma.payrollPeriod.count(),
    ]);

    return {
      periods: periods.map((p) => ({
        ...p,
        totalAmount: Number(p.totalAmount),
        itemCount: p._count.items,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findPeriodById(periodId: number) {
    const period = await prisma.payrollPeriod.findUnique({
      where: { periodId },
      include: {
        items: {
          include: {
            teacher: {
              include: {
                user: {
                  select: {
                    fullNameEn: true,
                    fullNameLo: true,
                    email: true,
                    phoneNumber: true,
                  },
                },
              },
            },
          },
          orderBy: { itemId: 'asc' },
        },
      },
    });

    if (!period) return null;

    return {
      ...period,
      totalAmount: Number(period.totalAmount),
      items: period.items.map((item) => ({
        ...item,
        baseSalary: Number(item.baseSalary),
        teachingAllowance: Number(item.teachingAllowance),
        attendanceBonus: Number(item.attendanceBonus),
        otherAllowance: Number(item.otherAllowance),
        absenceDeduction: Number(item.absenceDeduction),
        taxDeduction: Number(item.taxDeduction),
        otherDeduction: Number(item.otherDeduction),
        netSalary: Number(item.netSalary),
      })),
    };
  }

  async findPeriodByMonth(periodMonth: string) {
    return prisma.payrollPeriod.findUnique({
      where: { periodMonth },
    });
  }

  async generatePeriod(periodMonth: string, notes?: string) {
    const existing = await this.findPeriodByMonth(periodMonth);
    if (existing) {
      throw Object.assign(new Error(`Payroll period for ${periodMonth} already exists`), { statusCode: 409 });
    }

    const { nameEn, nameLo } = formatPeriodName(periodMonth);
    const { startDate, endDate } = getMonthDateRange(periodMonth);

    // Fetch all active teachers
    const teachers = await prisma.teacher.findMany({
      where: {
        user: { isActive: true },
      },
      include: {
        user: {
          select: { fullNameEn: true, fullNameLo: true },
        },
      },
    });

    return prisma.$transaction(async (tx) => {
      let totalAmount = 0;

      const period = await tx.payrollPeriod.create({
        data: {
          periodMonth,
          nameEn,
          nameLo,
          startDate,
          endDate,
          status: 'draft',
          notes: notes || null,
        },
      });

      for (const t of teachers) {
        const baseSalary = Number(t.salary) || 0;
        const netSalary = calculateNetSalary({ baseSalary });
        totalAmount += netSalary;

        await tx.payrollItem.create({
          data: {
            periodId: period.periodId,
            teacherId: t.teacherId,
            baseSalary,
            teachingAllowance: 0,
            attendanceBonus: 0,
            otherAllowance: 0,
            absenceDeduction: 0,
            taxDeduction: 0,
            otherDeduction: 0,
            netSalary,
            bankName: t.bankName || null,
            bankAccountName: t.bankAccountName || t.user.fullNameEn,
            bankAccountNumber: t.bankAccountNumber || null,
            status: 'pending',
          },
        });
      }

      const updatedPeriod = await tx.payrollPeriod.update({
        where: { periodId: period.periodId },
        data: { totalAmount },
      });

      return updatedPeriod;
    });
  }

  async updateItem(itemId: number, data: any) {
    const item = await prisma.payrollItem.findUnique({
      where: { itemId },
      include: { period: true },
    });

    if (!item) {
      throw Object.assign(new Error('Payroll item not found'), { statusCode: 404 });
    }

    if (item.period.status === 'paid') {
      throw Object.assign(new Error('Cannot edit items of a paid payroll period'), { statusCode: 400 });
    }

    const baseSalary = data.baseSalary !== undefined ? Number(data.baseSalary) : Number(item.baseSalary);
    const teachingAllowance = data.teachingAllowance !== undefined ? Number(data.teachingAllowance) : Number(item.teachingAllowance);
    const attendanceBonus = data.attendanceBonus !== undefined ? Number(data.attendanceBonus) : Number(item.attendanceBonus);
    const otherAllowance = data.otherAllowance !== undefined ? Number(data.otherAllowance) : Number(item.otherAllowance);
    const absenceDeduction = data.absenceDeduction !== undefined ? Number(data.absenceDeduction) : Number(item.absenceDeduction);
    const taxDeduction = data.taxDeduction !== undefined ? Number(data.taxDeduction) : Number(item.taxDeduction);
    const otherDeduction = data.otherDeduction !== undefined ? Number(data.otherDeduction) : Number(item.otherDeduction);

    const netSalary = calculateNetSalary({
      baseSalary,
      teachingAllowance,
      attendanceBonus,
      otherAllowance,
      absenceDeduction,
      taxDeduction,
      otherDeduction,
    });

    return prisma.$transaction(async (tx) => {
      const updatedItem = await tx.payrollItem.update({
        where: { itemId },
        data: {
          baseSalary,
          teachingAllowance,
          attendanceBonus,
          otherAllowance,
          absenceDeduction,
          taxDeduction,
          otherDeduction,
          netSalary,
          bankName: data.bankName !== undefined ? data.bankName : item.bankName,
          bankAccountName: data.bankAccountName !== undefined ? data.bankAccountName : item.bankAccountName,
          bankAccountNumber: data.bankAccountNumber !== undefined ? data.bankAccountNumber : item.bankAccountNumber,
          notes: data.notes !== undefined ? data.notes : item.notes,
        },
      });

      // Recalculate total amount for period
      const allItems = await tx.payrollItem.findMany({
        where: { periodId: item.periodId },
        select: { netSalary: true },
      });
      const newTotal = allItems.reduce((acc, it) => acc + Number(it.netSalary), 0);

      await tx.payrollPeriod.update({
        where: { periodId: item.periodId },
        data: { totalAmount: newTotal },
      });

      return {
        ...updatedItem,
        baseSalary: Number(updatedItem.baseSalary),
        teachingAllowance: Number(updatedItem.teachingAllowance),
        attendanceBonus: Number(updatedItem.attendanceBonus),
        otherAllowance: Number(updatedItem.otherAllowance),
        absenceDeduction: Number(updatedItem.absenceDeduction),
        taxDeduction: Number(updatedItem.taxDeduction),
        otherDeduction: Number(updatedItem.otherDeduction),
        netSalary: Number(updatedItem.netSalary),
      };
    });
  }

  async updateItemSlip(itemId: number, slipUrl: string | null) {
    const item = await prisma.payrollItem.findUnique({ where: { itemId } });
    if (!item) throw Object.assign(new Error('Item not found'), { statusCode: 404 });

    const updated = await prisma.payrollItem.update({
      where: { itemId },
      data: {
        slipUrl,
        paidAt: slipUrl ? new Date() : item.paidAt,
        status: slipUrl ? 'paid' : item.status,
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                fullNameEn: true,
                fullNameLo: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
    });

    return {
      ...updated,
      baseSalary: Number(updated.baseSalary),
      teachingAllowance: Number(updated.teachingAllowance),
      attendanceBonus: Number(updated.attendanceBonus),
      otherAllowance: Number(updated.otherAllowance),
      absenceDeduction: Number(updated.absenceDeduction),
      taxDeduction: Number(updated.taxDeduction),
      otherDeduction: Number(updated.otherDeduction),
      netSalary: Number(updated.netSalary),
    };
  }

  async updatePeriodStatus(periodId: number, status: 'draft' | 'approved' | 'paid') {
    const period = await prisma.payrollPeriod.findUnique({ where: { periodId } });
    if (!period) throw Object.assign(new Error('Period not found'), { statusCode: 404 });

    const now = new Date();
    const data: any = { status };
    if (status === 'approved') {
      data.processedAt = now;
    } else if (status === 'paid') {
      data.paidAt = now;
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.payrollPeriod.update({
        where: { periodId },
        data,
      });

      if (status === 'paid') {
        await tx.payrollItem.updateMany({
          where: { periodId },
          data: { status: 'paid' },
        });
      }

      return updated;
    });
  }

  async deletePeriod(periodId: number) {
    const period = await prisma.payrollPeriod.findUnique({ where: { periodId } });
    if (!period) throw Object.assign(new Error('Period not found'), { statusCode: 404 });
    if (period.status === 'paid') {
      throw Object.assign(new Error('Cannot delete a paid payroll period'), { statusCode: 400 });
    }
    return prisma.payrollPeriod.delete({ where: { periodId } });
  }

  async findTeacherPayslips(userId: number) {
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
    });
    if (!teacher) return [];

    const items = await prisma.payrollItem.findMany({
      where: {
        teacherId: teacher.teacherId,
        period: {
          status: { in: ['approved', 'paid'] },
        },
      },
      include: {
        period: true,
      },
      orderBy: {
        period: { periodMonth: 'desc' },
      },
    });

    return items.map((item) => ({
      ...item,
      baseSalary: Number(item.baseSalary),
      teachingAllowance: Number(item.teachingAllowance),
      attendanceBonus: Number(item.attendanceBonus),
      otherAllowance: Number(item.otherAllowance),
      absenceDeduction: Number(item.absenceDeduction),
      taxDeduction: Number(item.taxDeduction),
      otherDeduction: Number(item.otherDeduction),
      netSalary: Number(item.netSalary),
    }));
  }

  async findTeacherPayslip(userId: number, itemId: number) {
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            fullNameEn: true,
            fullNameLo: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });
    if (!teacher) return null;

    const item = await prisma.payrollItem.findFirst({
      where: {
        itemId,
        teacherId: teacher.teacherId,
        period: {
          status: { in: ['approved', 'paid'] },
        },
      },
      include: {
        period: true,
      },
    });

    if (!item) return null;

    return {
      ...item,
      teacher,
      baseSalary: Number(item.baseSalary),
      teachingAllowance: Number(item.teachingAllowance),
      attendanceBonus: Number(item.attendanceBonus),
      otherAllowance: Number(item.otherAllowance),
      absenceDeduction: Number(item.absenceDeduction),
      taxDeduction: Number(item.taxDeduction),
      otherDeduction: Number(item.otherDeduction),
      netSalary: Number(item.netSalary),
    };
  }
}

export default new PayrollRepository();
