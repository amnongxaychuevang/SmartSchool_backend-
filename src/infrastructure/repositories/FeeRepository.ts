import { Prisma } from '@prisma/client';
import prisma from '../database/PrismaClient';
import { startOfSchoolDay, schoolDateValue, addDays } from '../../domain/schoolTime';
import { amountDue, outstanding, invoiceStatus, isOverdue, paymentProblem, documentNo, type InvoiceStatus } from '../../domain/fees';

const fail = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });
const num = (v: Prisma.Decimal | number | null | undefined) => Number(v ?? 0);
const today = () => schoolDateValue(startOfSchoolDay());

const invoiceInclude = {
  student: {
    select: {
      studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true,
      classStudents: {
        where: { leftAt: null }, orderBy: { enrolledAt: 'desc' as const }, take: 1,
        select: { class: { select: { classId: true, classNameEn: true, classNameLo: true } } },
      },
    },
  },
  feeStructure: {
    select: {
      feeStructureId: true, academicYear: true,
      feeType: { select: { feeTypeId: true, nameEn: true, nameLo: true } },
      term: { select: { termId: true, termNameEn: true, termNameLo: true } },
    },
  },
} satisfies Prisma.InvoiceInclude;

type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

// The API shape: numbers instead of Decimals, the current class flattened, and
// the derived figures (amount due, outstanding, overdue) computed once here.
function present(inv: InvoiceRow) {
  const { classStudents, ...student } = inv.student;
  const amount = num(inv.amount);
  const discount = num(inv.discount);
  const paid = num(inv.paidAmount);
  return {
    ...inv,
    amount, discount, paidAmount: paid,
    amountDue: amountDue(amount, discount),
    outstanding: inv.status === 'void' ? 0 : outstanding(amount, discount, paid),
    overdue: isOverdue(inv.status, inv.dueDate, today()),
    student: { ...student, class: classStudents[0]?.class ?? null },
  };
}

export type InvoiceFilter = {
  status?: InvoiceStatus | 'overdue';
  studentId?: number;
  classId?: number;
  feeStructureId?: number;
  academicYear?: string;
  search?: string;
};

function invoiceWhere(f: InvoiceFilter): Prisma.InvoiceWhereInput {
  const q = f.search?.trim();
  return {
    ...(f.status === 'overdue'
      ? { status: { in: ['unpaid', 'partial'] }, dueDate: { lt: today() } }
      : f.status ? { status: f.status } : {}),
    ...(f.studentId ? { studentId: f.studentId } : {}),
    ...(f.feeStructureId ? { feeStructureId: f.feeStructureId } : {}),
    ...(f.academicYear ? { feeStructure: { academicYear: f.academicYear } } : {}),
    ...(f.classId ? { student: { classStudents: { some: { classId: f.classId, leftAt: null } } } } : {}),
    ...(q ? {
      OR: [
        { invoiceNo: { contains: q } },
        { student: { studentCode: { contains: q } } },
        { student: { fullNameEn: { contains: q } } },
        { student: { fullNameLo: { contains: q } } },
      ],
    } : {}),
  };
}

class FeeRepository {
  // ── Fee types ──
  listTypes() {
    return prisma.feeType.findMany({ orderBy: [{ isActive: 'desc' }, { nameEn: 'asc' }], include: { _count: { select: { structures: true } } } });
  }

  createType(data: Prisma.FeeTypeCreateInput) {
    return prisma.feeType.create({ data });
  }

  updateType(feeTypeId: number, data: Prisma.FeeTypeUpdateInput) {
    return prisma.feeType.update({ where: { feeTypeId }, data });
  }

  async deleteType(feeTypeId: number) {
    const used = await prisma.feeStructure.count({ where: { feeTypeId } });
    if (used) throw fail('This fee type is used by fee structures; deactivate it instead', 409);
    await prisma.feeType.delete({ where: { feeTypeId } });
  }

  // ── Fee structures ──
  async listStructures(academicYear?: string) {
    const structures = await prisma.feeStructure.findMany({
      where: academicYear ? { academicYear } : {},
      orderBy: [{ academicYear: 'desc' }, { dueDate: 'asc' }],
      include: {
        feeType: { select: { feeTypeId: true, nameEn: true, nameLo: true } },
        term: { select: { termId: true, termNameEn: true, termNameLo: true } },
        class: { select: { classId: true, classNameEn: true, classNameLo: true } },
      },
    });
    const totals = await prisma.invoice.groupBy({
      by: ['feeStructureId'],
      where: { feeStructureId: { in: structures.map((s) => s.feeStructureId) }, status: { not: 'void' } },
      _count: { _all: true },
      _sum: { amount: true, discount: true, paidAmount: true },
    });
    return structures.map((s) => {
      const t = totals.find((x) => x.feeStructureId === s.feeStructureId);
      const billed = num(t?._sum.amount) - num(t?._sum.discount);
      return {
        ...s, amount: num(s.amount),
        invoiceCount: t?._count._all ?? 0, billed, collected: num(t?._sum.paidAmount),
      };
    });
  }

  createStructure(data: Prisma.FeeStructureUncheckedCreateInput) {
    return prisma.feeStructure.create({ data });
  }

  async updateStructure(feeStructureId: number, data: Prisma.FeeStructureUncheckedUpdateInput) {
    const invoiced = await prisma.invoice.count({ where: { feeStructureId } });
    // Once billed, the amount and target are fixed (they are on the invoices); only
    // the due date and notes may still change, and the due date follows to unpaid invoices.
    if (invoiced && (data.amount !== undefined || data.classId !== undefined || data.feeTypeId !== undefined
      || data.academicYear !== undefined || data.termId !== undefined)) {
      throw fail('Invoices were already issued for this fee; only the due date and notes can change', 409);
    }
    return prisma.$transaction(async (tx) => {
      const updated = await tx.feeStructure.update({ where: { feeStructureId }, data });
      if (data.dueDate) {
        await tx.invoice.updateMany({ where: { feeStructureId, status: 'unpaid' }, data: { dueDate: data.dueDate as Date } });
      }
      return updated;
    });
  }

  async deleteStructure(feeStructureId: number) {
    const invoiced = await prisma.invoice.count({ where: { feeStructureId } });
    if (invoiced) throw fail('Invoices were already issued for this fee; void them instead', 409);
    await prisma.feeStructure.delete({ where: { feeStructureId } });
  }

  /**
   * Bills every active student the structure applies to (its class, or every
   * class of its school year) who has not been billed for it yet. Safe to run
   * again, e.g. after new students enrol.
   */
  async generateInvoices(feeStructureId: number, issuedBy: number) {
    const s = await prisma.feeStructure.findUnique({ where: { feeStructureId } });
    if (!s) throw fail('Fee structure not found', 404);

    const students = await prisma.student.findMany({
      where: {
        status: 'active',
        classStudents: { some: { leftAt: null, class: s.classId ? { classId: s.classId } : { academicYear: s.academicYear } } },
        invoices: { none: { feeStructureId } },
      },
      select: { studentId: true },
    });

    const year = Number(s.academicYear.slice(0, 4));
    const created = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const { studentId } of students) {
        const inv = await tx.invoice.create({
          data: {
            invoiceNo: `TMP-${feeStructureId}-${studentId}`, studentId, feeStructureId,
            amount: s.amount, dueDate: s.dueDate, issuedBy,
          },
        });
        await tx.invoice.update({ where: { invoiceId: inv.invoiceId }, data: { invoiceNo: documentNo('INV', year, inv.invoiceId) } });
        count++;
      }
      return count;
    }, { timeout: 60_000 });
    return { created, alreadyBilled: await prisma.invoice.count({ where: { feeStructureId } }) - created };
  }

  // ── Invoices ──
  async listInvoices(filter: InvoiceFilter, page = 1, limit = 20) {
    const where = invoiceWhere(filter);
    const [rows, total] = await Promise.all([
      prisma.invoice.findMany({ where, include: invoiceInclude, orderBy: [{ dueDate: 'asc' }, { invoiceId: 'asc' }], skip: (page - 1) * limit, take: limit }),
      prisma.invoice.count({ where }),
    ]);
    return { invoices: rows.map(present), total, page, limit };
  }

  async getInvoice(invoiceId: number) {
    const inv = await prisma.invoice.findUnique({
      where: { invoiceId },
      include: {
        ...invoiceInclude,
        payments: { orderBy: { paidAt: 'desc' }, include: { receiver: { select: { userId: true, fullNameEn: true, fullNameLo: true } } } },
      },
    });
    if (!inv) throw fail('Invoice not found', 404);
    return { ...present(inv), payments: inv.payments.map((p) => ({ ...p, amount: num(p.amount) })) };
  }

  async updateInvoice(invoiceId: number, data: { discount?: number; dueDate?: Date; notes?: string }) {
    const inv = await prisma.invoice.findUnique({ where: { invoiceId } });
    if (!inv) throw fail('Invoice not found', 404);
    if (inv.status === 'void') throw fail('This invoice has been voided', 409);
    const discount = data.discount ?? num(inv.discount);
    if (discount > num(inv.amount)) throw fail('The discount cannot be more than the invoice amount', 422);
    await prisma.invoice.update({
      where: { invoiceId },
      data: { ...data, status: invoiceStatus(num(inv.amount), discount, num(inv.paidAmount), inv.status) },
    });
    return this.getInvoice(invoiceId);
  }

  async voidInvoice(invoiceId: number, reason: string) {
    const inv = await prisma.invoice.findUnique({ where: { invoiceId } });
    if (!inv) throw fail('Invoice not found', 404);
    if (num(inv.paidAmount) > 0) throw fail('Payments were recorded on this invoice; it cannot be voided', 409);
    await prisma.invoice.update({ where: { invoiceId }, data: { status: 'void', voidReason: reason } });
    return this.getInvoice(invoiceId);
  }

  async recordPayment(invoiceId: number, p: { amount: number; method: 'cash' | 'bank_transfer'; referenceNo?: string; notes?: string; paidAt?: Date }, receivedBy: number) {
    return prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({ where: { invoiceId } });
      if (!inv) throw fail('Invoice not found', 404);
      const owed = outstanding(num(inv.amount), num(inv.discount), num(inv.paidAmount));
      const problem = paymentProblem(inv.status, p.amount, owed);
      if (problem) throw fail(problem, 422);

      const payment = await tx.feePayment.create({
        data: { receiptNo: `TMP-${invoiceId}-${Date.now()}`, invoiceId, amount: p.amount, method: p.method, referenceNo: p.referenceNo, notes: p.notes, paidAt: p.paidAt, receivedBy },
      });
      const year = (p.paidAt ?? new Date()).getFullYear();
      const saved = await tx.feePayment.update({ where: { paymentId: payment.paymentId }, data: { receiptNo: documentNo('RCPT', year, payment.paymentId) } });

      const paid = num(inv.paidAmount) + p.amount;
      await tx.invoice.update({
        where: { invoiceId },
        data: { paidAmount: paid, status: invoiceStatus(num(inv.amount), num(inv.discount), paid, inv.status) },
      });
      return { ...saved, amount: num(saved.amount) };
    });
  }

  // ── Report ──
  async report(academicYear: string) {
    const where: Prisma.InvoiceWhereInput = { status: { not: 'void' }, feeStructure: { academicYear } };
    const invoices = await prisma.invoice.findMany({
      where,
      select: {
        amount: true, discount: true, paidAmount: true, status: true, dueDate: true,
        feeStructure: { select: { feeType: { select: { feeTypeId: true, nameEn: true, nameLo: true } } } },
        student: { select: { classStudents: { where: { leftAt: null }, take: 1, orderBy: { enrolledAt: 'desc' }, select: { class: { select: { classId: true, classNameEn: true, classNameLo: true } } } } } },
      },
    });

    const t = today();
    const totals = { invoices: invoices.length, billed: 0, collected: 0, outstanding: 0, overdueCount: 0, overdueAmount: 0, paidCount: 0 };
    const byClass = new Map<number, { classId: number; classNameEn: string; classNameLo: string; billed: number; collected: number; students: number; paid: number }>();
    const byType = new Map<number, { feeTypeId: number; nameEn: string; nameLo: string; billed: number; collected: number }>();
    for (const inv of invoices) {
      const due = amountDue(num(inv.amount), num(inv.discount));
      const paid = num(inv.paidAmount);
      const owe = outstanding(num(inv.amount), num(inv.discount), paid);
      totals.billed += due; totals.collected += paid; totals.outstanding += owe;
      if (inv.status === 'paid') totals.paidCount++;
      if (isOverdue(inv.status, inv.dueDate, t)) { totals.overdueCount++; totals.overdueAmount += owe; }

      const cls = inv.student.classStudents[0]?.class;
      if (cls) {
        const row = byClass.get(cls.classId) ?? { ...cls, billed: 0, collected: 0, students: 0, paid: 0 };
        row.billed += due; row.collected += paid; row.students++; if (inv.status === 'paid') row.paid++;
        byClass.set(cls.classId, row);
      }
      const ft = inv.feeStructure.feeType;
      const trow = byType.get(ft.feeTypeId) ?? { ...ft, billed: 0, collected: 0 };
      trow.billed += due; trow.collected += paid;
      byType.set(ft.feeTypeId, trow);
    }

    // Collections per month for the last six months, from the payments themselves.
    const since = addDays(startOfSchoolDay(), -183);
    const payments = await prisma.feePayment.findMany({
      where: { paidAt: { gte: since }, invoice: { feeStructure: { academicYear } } },
      orderBy: { paidAt: 'desc' },
      include: {
        invoice: { select: { invoiceNo: true, student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } } } },
        receiver: { select: { fullNameEn: true, fullNameLo: true } },
      },
    });
    const monthly = new Map<string, number>();
    for (const p of payments) {
      const month = new Date(p.paidAt.getTime() + 7 * 3600e3).toISOString().slice(0, 7); // school clock
      monthly.set(month, (monthly.get(month) ?? 0) + num(p.amount));
    }

    const rate = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
    return {
      academicYear,
      totals: { ...totals, collectionRate: rate(totals.collected, totals.billed) },
      byClass: [...byClass.values()].map((c) => ({ ...c, collectionRate: rate(c.collected, c.billed) })).sort((a, b) => a.classNameEn.localeCompare(b.classNameEn)),
      byFeeType: [...byType.values()].map((x) => ({ ...x, collectionRate: rate(x.collected, x.billed) })),
      monthly: [...monthly.entries()].map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month)),
      recentPayments: payments.slice(0, 10).map((p) => ({ ...p, amount: num(p.amount) })),
    };
  }

  // ── Parent view ──
  async invoicesForStudent(studentId: number) {
    const rows = await prisma.invoice.findMany({
      where: { studentId, status: { not: 'void' } },
      include: { ...invoiceInclude, payments: { orderBy: { paidAt: 'desc' }, select: { receiptNo: true, amount: true, method: true, paidAt: true } } },
      orderBy: { dueDate: 'desc' },
    });
    return rows.map((r) => ({ ...present(r), payments: r.payments.map((p) => ({ ...p, amount: num(p.amount) })) }));
  }
}

export default new FeeRepository();
