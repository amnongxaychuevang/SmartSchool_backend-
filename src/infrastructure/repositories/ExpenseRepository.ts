import prisma from '../database/PrismaClient';

export const expenseDocumentNo = (year: number, id: number) => `EXP-${year}-${String(id).padStart(5, '0')}`;

const DEFAULT_CATEGORIES = [
  { nameLo: 'ຄ່າໄຟຟ້າ, ນ້ຳປະປາ & ອິນເຕີເນັດ', nameEn: 'Utilities (Water, Electricity, Internet)', icon: 'bolt' },
  { nameLo: 'ອຸປະກອນການຮຽນ-ການສອນ & ຫ້ອງການ', nameEn: 'Educational & Office Supplies', icon: 'book' },
  { nameLo: 'ຄ່າສ້ອມແປງ & ບຳລຸງຮັກສາອາຄານ', nameEn: 'Maintenance & Facility Repairs', icon: 'wrench' },
  { nameLo: 'ກິດຈະກຳໂຮງຮຽນ, ກິລາ & ງານບຸນ', nameEn: 'School Events, Sports & Activities', icon: 'trophy' },
  { nameLo: 'ຄ່າຂົນສົ່ງ & ນ້ຳມັນລົດເມ', nameEn: 'Transportation & Bus Fuel', icon: 'truck' },
  { nameLo: 'ອາຫານ, ເຄື່ອງດື່ມ & ຕ້ອນຮັບ', nameEn: 'Food, Catering & Hospitality', icon: 'cup' },
  { nameLo: 'ລາຍຈ່າຍອື່ນໆ', nameEn: 'Miscellaneous Expenses', icon: 'dots' },
];

class ExpenseRepository {
  async ensureDefaultCategories() {
    const count = await prisma.expenseCategory.count();
    if (count === 0) {
      await prisma.expenseCategory.createMany({
        data: DEFAULT_CATEGORIES.map((c) => ({
          nameLo: c.nameLo,
          nameEn: c.nameEn,
          icon: c.icon,
          isActive: true,
        })),
      });
    }
  }

  // ─── Categories ──────────────────────────────────────────
  async listCategories(includeInactive = false) {
    await this.ensureDefaultCategories();
    return prisma.expenseCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { categoryId: 'asc' },
      include: {
        _count: { select: { expenses: true } },
      },
    });
  }

  async getCategory(categoryId: number) {
    return prisma.expenseCategory.findUnique({ where: { categoryId } });
  }

  async createCategory(data: { nameEn?: string; nameLo?: string; icon?: string; description?: string; isActive?: boolean }) {
    const nameLo = data.nameLo || data.nameEn || 'ໝວດໝູ່ໃໝ່';
    const nameEn = data.nameEn || data.nameLo || 'New Category';
    return prisma.expenseCategory.create({
      data: {
        nameLo,
        nameEn,
        icon: data.icon,
        description: data.description,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateCategory(categoryId: number, data: Partial<{ nameEn: string; nameLo: string; icon?: string; description?: string; isActive?: boolean }>) {
    return prisma.expenseCategory.update({
      where: { categoryId },
      data,
    });
  }

  async deleteCategory(categoryId: number) {
    const expensesCount = await prisma.expense.count({ where: { categoryId } });
    if (expensesCount > 0) {
      const err: any = new Error('Cannot delete category with existing expenses. Deactivate it instead.');
      err.statusCode = 400;
      throw err;
    }
    return prisma.expenseCategory.delete({ where: { categoryId } });
  }

  // ─── Expenses ────────────────────────────────────────────
  async listExpenses({
    search = '',
    categoryId,
    academicYear,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  }: {
    search?: string;
    categoryId?: number;
    academicYear?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  } = {}) {
    await this.ensureDefaultCategories();
    const skip = (page - 1) * limit;
    const where: any = {};

    if (categoryId) where.categoryId = categoryId;
    if (academicYear) where.academicYear = academicYear;
    if (startDate || endDate) {
      const gte = startDate ? new Date(startDate) : undefined;
      const lte = endDate ? new Date(endDate) : undefined;
      where.expenseDate = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
    }

    if (search) {
      where.OR = [
        { expenseNo: { contains: search } },
        { title: { contains: search } },
        { paidTo: { contains: search } },
        { referenceNo: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ expenseDate: 'desc' }, { expenseId: 'desc' }],
        include: {
          category: {
            select: { categoryId: true, nameEn: true, nameLo: true, icon: true },
          },
          recorder: {
            select: { userId: true, fullNameEn: true, fullNameLo: true },
          },
        },
      }),
      prisma.expense.count({ where }),
    ]);

    const expenses = rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
    }));

    return { expenses, total, page, limit };
  }

  async getExpense(expenseId: number) {
    const expense = await prisma.expense.findUnique({
      where: { expenseId },
      include: {
        category: true,
        recorder: {
          select: { userId: true, fullNameEn: true, fullNameLo: true },
        },
      },
    });
    if (!expense) return null;
    return {
      ...expense,
      amount: Number(expense.amount),
    };
  }

  async createExpense(
    data: {
      categoryId: number;
      academicYear: string;
      title: string;
      description?: string;
      amount: number;
      expenseDate: Date;
      paymentMethod?: string;
      paidTo?: string;
      referenceNo?: string;
    },
    recordedBy?: number,
  ) {
    const year = new Date(data.expenseDate).getFullYear();

    return prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          expenseNo: `TMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          categoryId: data.categoryId,
          academicYear: data.academicYear,
          title: data.title,
          description: data.description || null,
          amount: data.amount,
          expenseDate: new Date(data.expenseDate),
          paymentMethod: data.paymentMethod || 'cash',
          paidTo: data.paidTo || null,
          referenceNo: data.referenceNo || null,
          recordedBy: recordedBy ? Number(recordedBy) : null,
        },
      });

      const finalExpenseNo = expenseDocumentNo(year, created.expenseId);
      const updated = await tx.expense.update({
        where: { expenseId: created.expenseId },
        data: { expenseNo: finalExpenseNo },
        include: {
          category: true,
          recorder: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
        },
      });

      return {
        ...updated,
        amount: Number(updated.amount),
      };
    });
  }

  async updateExpense(
    expenseId: number,
    data: Partial<{
      categoryId: number;
      academicYear: string;
      title: string;
      description?: string;
      amount: number;
      expenseDate: Date;
      paymentMethod?: string;
      paidTo?: string;
      referenceNo?: string;
    }>,
  ) {
    const updated = await prisma.expense.update({
      where: { expenseId },
      data: {
        ...(data.categoryId ? { categoryId: data.categoryId } : {}),
        ...(data.academicYear ? { academicYear: data.academicYear } : {}),
        ...(data.title ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.expenseDate ? { expenseDate: new Date(data.expenseDate) } : {}),
        ...(data.paymentMethod ? { paymentMethod: data.paymentMethod } : {}),
        ...(data.paidTo !== undefined ? { paidTo: data.paidTo } : {}),
        ...(data.referenceNo !== undefined ? { referenceNo: data.referenceNo } : {}),
      },
      include: {
        category: true,
        recorder: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
      },
    });

    return {
      ...updated,
      amount: Number(updated.amount),
    };
  }

  async setExpenseReceipt(expenseId: number, receiptUrl: string | null) {
    return prisma.expense.update({
      where: { expenseId },
      data: { receiptUrl },
    });
  }

  async deleteExpense(expenseId: number) {
    return prisma.expense.delete({ where: { expenseId } });
  }
}

export default new ExpenseRepository();
