import prisma from '../database/PrismaClient';
import { startOfSchoolDay, schoolDateValue, addDays } from '../../domain/schoolTime';
import { amountDue, outstanding, isOverdue } from '../../domain/fees';

const num = (v: unknown) => Number(v ?? 0);
const DAY_MS = 86400000;

// Days past due → ageing bucket used on the debtors report.
export type AgeBucket = 'not_due' | 'd1_30' | 'd31_60' | 'd60_plus';
export const ageBucket = (daysOverdue: number): AgeBucket =>
  daysOverdue <= 0 ? 'not_due' : daysOverdue <= 30 ? 'd1_30' : daysOverdue <= 60 ? 'd31_60' : 'd60_plus';

// Same scale as the printed report card.
export const letterGrade = (pct: number) => (pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F');

export class SchoolReportRepository {
  // ── Student demographics: whole-school counts by status, gender and current class ──
  async studentStats() {
    const [byStatus, byGender, classes] = await Promise.all([
      prisma.student.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.student.groupBy({ by: ['gender'], where: { status: 'active' }, _count: { _all: true } }),
      prisma.class.findMany({
        where: { classStudents: { some: { leftAt: null } } },
        orderBy: [{ academicYear: 'desc' }, { classNameEn: 'asc' }],
        select: {
          classId: true, classNameEn: true, classNameLo: true, gradeLevelEn: true, gradeLevelLo: true, academicYear: true,
          classStudents: { where: { leftAt: null, student: { status: 'active' } }, select: { student: { select: { gender: true } } } },
        },
      }),
    ]);
    const status = Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])) as Record<string, number>;
    const gender = { male: 0, female: 0, other: 0, unknown: 0 };
    for (const g of byGender) gender[(g.gender ?? 'unknown') as keyof typeof gender] += g._count._all;
    return {
      total: byStatus.reduce((s, r) => s + r._count._all, 0),
      status: { active: status.active ?? 0, inactive: status.inactive ?? 0, graduated: status.graduated ?? 0, transferred: status.transferred ?? 0 },
      gender,
      classes: classes
        .map((c) => {
          const g = { male: 0, female: 0 };
          for (const cs of c.classStudents) if (cs.student.gender === 'male' || cs.student.gender === 'female') g[cs.student.gender]++;
          return {
            classId: c.classId, classNameEn: c.classNameEn, classNameLo: c.classNameLo, gradeLevelEn: c.gradeLevelEn, gradeLevelLo: c.gradeLevelLo,
            academicYear: c.academicYear, students: c.classStudents.length, ...g,
          };
        })
        .filter((c) => c.students > 0),
    };
  }

  // ── Debtors: every student still owing, oldest debt first (all years unless one is given) ──
  async debtors(academicYear?: string) {
    const today = schoolDateValue(startOfSchoolDay());
    const invoices = await prisma.invoice.findMany({
      where: { status: { in: ['unpaid', 'partial'] }, ...(academicYear ? { feeStructure: { academicYear } } : {}) },
      select: {
        invoiceId: true, invoiceNo: true, amount: true, discount: true, paidAmount: true, status: true, dueDate: true,
        feeStructure: { select: { academicYear: true, feeType: { select: { nameEn: true, nameLo: true } } } },
        student: {
          select: {
            studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true, photoUrl: true,
            classStudents: { where: { leftAt: null }, take: 1, orderBy: { enrolledAt: 'desc' }, select: { class: { select: { classId: true, classNameEn: true, classNameLo: true } } } },
            parentStudents: {
              orderBy: { isPrimaryContact: 'desc' },
              take: 1,
              select: { parent: { select: { fullNameEn: true, fullNameLo: true, phoneNumber: true } } },
            },
          },
        },
      },
    });

    const byStudent = new Map<number, any>();
    for (const inv of invoices) {
      const owed = outstanding(num(inv.amount), num(inv.discount), num(inv.paidAmount));
      if (owed <= 0) continue;
      const overdue = isOverdue(inv.status as any, inv.dueDate, today);
      const daysOverdue = overdue ? Math.round((today.getTime() - inv.dueDate.getTime()) / DAY_MS) : 0;
      const s = inv.student;
      const row = byStudent.get(s.studentId) ?? {
        studentId: s.studentId, studentCode: s.studentCode, fullNameEn: s.fullNameEn, fullNameLo: s.fullNameLo, photoUrl: s.photoUrl,
        class: s.classStudents[0]?.class ?? null,
        parent: s.parentStudents[0]?.parent ?? null,
        invoices: [], outstanding: 0, overdueAmount: 0, maxDaysOverdue: 0,
      };
      row.invoices.push({
        invoiceId: inv.invoiceId, invoiceNo: inv.invoiceNo, dueDate: inv.dueDate, outstanding: owed, daysOverdue,
        billed: amountDue(num(inv.amount), num(inv.discount)), feeType: inv.feeStructure.feeType, academicYear: inv.feeStructure.academicYear,
      });
      row.outstanding += owed;
      if (overdue) row.overdueAmount += owed;
      row.maxDaysOverdue = Math.max(row.maxDaysOverdue, daysOverdue);
      byStudent.set(s.studentId, row);
    }

    const students = [...byStudent.values()]
      .map((r) => ({ ...r, bucket: ageBucket(r.maxDaysOverdue) }))
      .sort((a, b) => b.maxDaysOverdue - a.maxDaysOverdue || b.outstanding - a.outstanding);

    const buckets: Record<AgeBucket, { students: number; amount: number }> = {
      not_due: { students: 0, amount: 0 }, d1_30: { students: 0, amount: 0 }, d31_60: { students: 0, amount: 0 }, d60_plus: { students: 0, amount: 0 },
    };
    for (const r of students) { buckets[r.bucket].students++; buckets[r.bucket].amount += r.outstanding; }

    return {
      academicYear: academicYear ?? null,
      totals: { students: students.length, outstanding: students.reduce((s, r) => s + r.outstanding, 0), overdue: students.reduce((s, r) => s + r.overdueAmount, 0) },
      buckets,
      students,
    };
  }

  // ── Daily cash: money received on one school day, by method and by staff member ──
  async dailyCash(ymd: string) {
    const from = new Date(Date.parse(`${ymd}T00:00:00+07:00`));
    const to = addDays(from, 1);
    const [payments, topUps] = await Promise.all([
      prisma.feePayment.findMany({
        where: { paidAt: { gte: from, lt: to } },
        orderBy: { paidAt: 'asc' },
        include: {
          invoice: { select: { invoiceNo: true, student: { select: { studentCode: true, fullNameEn: true, fullNameLo: true } } } },
          receiver: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
        },
      }),
      prisma.topUpRequest.findMany({
        where: { status: 'approved', processedAt: { gte: from, lt: to } },
        orderBy: { processedAt: 'asc' },
        include: {
          student: { select: { studentCode: true, fullNameEn: true, fullNameLo: true } },
          approver: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
        },
      }),
    ]);

    const byMethod = { cash: 0, bank_transfer: 0 } as Record<string, number>;
    const staff = new Map<number, { userId: number; fullNameEn: string; fullNameLo: string; cash: number; transfer: number; count: number }>();
    const addStaff = (u: { userId: number; fullNameEn: string; fullNameLo: string } | null, method: string, amount: number) => {
      if (!u) return;
      const row = staff.get(u.userId) ?? { ...u, cash: 0, transfer: 0, count: 0 };
      if (method === 'cash') row.cash += amount; else row.transfer += amount;
      row.count++;
      staff.set(u.userId, row);
    };

    const entries = [
      ...payments.map((p) => {
        const amount = num(p.amount);
        const method = p.method === 'cash' ? 'cash' : 'bank_transfer';
        byMethod[method] += amount;
        addStaff(p.receiver, method, amount);
        return {
          kind: 'fee' as const, id: p.paymentId, time: p.paidAt, amount, method, reference: p.receiptNo,
          student: p.invoice.student, staff: p.receiver ? { fullNameEn: p.receiver.fullNameEn, fullNameLo: p.receiver.fullNameLo } : null,
        };
      }),
      ...topUps.map((t) => {
        const amount = num(t.amount);
        const method = t.method === 'cash' ? 'cash' : 'bank_transfer';
        byMethod[method] += amount;
        addStaff(t.approver, method, amount);
        return {
          kind: 'topup' as const, id: t.requestId, time: t.processedAt!, amount, method, reference: `TU-${t.requestId}`,
          student: t.student, staff: t.approver ? { fullNameEn: t.approver.fullNameEn, fullNameLo: t.approver.fullNameLo } : null,
        };
      }),
    ].sort((a, b) => a.time.getTime() - b.time.getTime());

    const feeTotal = payments.reduce((s, p) => s + num(p.amount), 0);
    const topUpTotal = topUps.reduce((s, t) => s + num(t.amount), 0);
    return {
      date: ymd,
      totals: { all: feeTotal + topUpTotal, fees: feeTotal, topUps: topUpTotal, cash: byMethod.cash, transfer: byMethod.bank_transfer, count: entries.length },
      staff: [...staff.values()].sort((a, b) => b.cash + b.transfer - (a.cash + a.transfer)),
      entries,
    };
  }

  // ── Class results: each student's % per subject for one term, ranked ──
  async classResults(classId: number, termId: number) {
    const [cls, term, roster, grades] = await Promise.all([
      prisma.class.findUnique({ where: { classId }, select: { classId: true, classNameEn: true, classNameLo: true, academicYear: true } }),
      prisma.academicTerm.findUnique({ where: { termId }, select: { termId: true, termNameEn: true, termNameLo: true, academicYear: true } }),
      prisma.classStudent.findMany({
        where: { classId, leftAt: null },
        select: { student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true, photoUrl: true } } },
      }),
      prisma.grade.findMany({
        where: { score: { not: null }, classSubject: { classId, termId } },
        select: {
          studentId: true, score: true, maxScore: true,
          classSubject: { select: { subject: { select: { subjectId: true, subjectNameEn: true, subjectNameLo: true } } } },
        },
      }),
    ]);
    if (!cls) throw Object.assign(new Error('Class not found'), { statusCode: 404 });
    if (!term) throw Object.assign(new Error('Term not found'), { statusCode: 404 });

    const subjects = new Map<number, { subjectId: number; subjectNameEn: string; subjectNameLo: string }>();
    // studentId → subjectId → [score, max]
    const sums = new Map<number, Map<number, [number, number]>>();
    for (const g of grades) {
      const sub = g.classSubject.subject;
      subjects.set(sub.subjectId, sub);
      const perStudent = sums.get(g.studentId) ?? new Map<number, [number, number]>();
      const cur = perStudent.get(sub.subjectId) ?? [0, 0];
      perStudent.set(sub.subjectId, [cur[0] + num(g.score), cur[1] + num(g.maxScore)]);
      sums.set(g.studentId, perStudent);
    }

    const round1 = (n: number) => Math.round(n * 10) / 10;
    const students = roster.map(({ student }) => {
      const perStudent = sums.get(student.studentId);
      const scores: Record<number, number | null> = {};
      let total = 0;
      let max = 0;
      for (const sub of subjects.values()) {
        const s = perStudent?.get(sub.subjectId);
        scores[sub.subjectId] = s && s[1] > 0 ? round1((s[0] / s[1]) * 100) : null;
        if (s) { total += s[0]; max += s[1]; }
      }
      const average = max > 0 ? round1((total / max) * 100) : null;
      return { ...student, scores, average, letter: average === null ? null : letterGrade(average), rank: null as number | null };
    });

    // Competition ranking (1, 2, 2, 4); students with no grades are unranked and listed last.
    const ranked = students.filter((s) => s.average !== null).sort((a, b) => b.average! - a.average!);
    ranked.forEach((s, i) => { s.rank = i > 0 && ranked[i - 1].average === s.average ? ranked[i - 1].rank : i + 1; });
    const ordered = [...ranked, ...students.filter((s) => s.average === null).sort((a, b) => a.fullNameEn.localeCompare(b.fullNameEn))];

    const subjectList = [...subjects.values()].sort((a, b) => a.subjectNameEn.localeCompare(b.subjectNameEn));
    const subjectAverages = Object.fromEntries(subjectList.map((sub) => {
      const vals = students.map((s) => s.scores[sub.subjectId]).filter((v): v is number => v !== null);
      return [sub.subjectId, vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null];
    }));
    const averages = ranked.map((s) => s.average!);

    return {
      class: cls,
      term,
      subjects: subjectList,
      subjectAverages,
      summary: {
        students: students.length,
        graded: ranked.length,
        classAverage: averages.length ? round1(averages.reduce((a, b) => a + b, 0) / averages.length) : null,
        passRate: averages.length ? round1((averages.filter((a) => a >= 50).length / averages.length) * 100) : null,
      },
      students: ordered,
    };
  }

  // ── Cashflow / Income & Expense summary ──
  async cashflowSummary({ academicYear, startDate, endDate }: { academicYear?: string; startDate?: string; endDate?: string } = {}) {
    const feeWhere: any = {};
    const rentalWhere: any = { status: { in: ['paid', 'partial'] } };
    const payrollWhere: any = { status: { in: ['approved', 'paid'] } };
    const expenseWhere: any = {};

    if (startDate || endDate) {
      const gte = startDate ? new Date(startDate) : undefined;
      const lte = endDate ? new Date(endDate) : undefined;
      feeWhere.paidAt = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
      rentalWhere.paidAt = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
      payrollWhere.approvedAt = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
      expenseWhere.expenseDate = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
    }

    if (academicYear) {
      feeWhere.invoice = { feeStructure: { academicYear } };
      rentalWhere.academicYear = academicYear;
      payrollWhere.academicYear = academicYear;
      expenseWhere.academicYear = academicYear;
    }

    const [feePayments, shopRentals, payrollPeriods, generalExpenses] = await Promise.all([
      prisma.feePayment.findMany({
        where: feeWhere,
        include: {
          invoice: {
            select: {
              feeStructure: {
                select: {
                  academicYear: true,
                  feeType: { select: { feeTypeId: true, nameEn: true, nameLo: true } },
                },
              },
            },
          },
        },
      }),
      prisma.shopRentalPayment.findMany({
        where: rentalWhere,
        include: {
          shop: { select: { shopId: true, shopNameEn: true, shopNameLo: true } },
        },
      }),
      prisma.payrollPeriod.findMany({
        where: payrollWhere,
        include: {
          items: {
            select: {
              netSalary: true,
              baseSalary: true,
              totalAllowances: true,
              totalDeductions: true,
            },
          },
        },
      }),
      prisma.expense.findMany({
        where: expenseWhere,
        include: {
          category: { select: { categoryId: true, nameEn: true, nameLo: true, icon: true } },
        },
      }),
    ]);

    // Aggregate Fee Payments by FeeType
    const feesByType = new Map<number, { nameEn: string; nameLo: string; total: number; count: number }>();
    let totalStudentFees = 0;
    for (const fp of feePayments) {
      const amt = num(fp.amount);
      totalStudentFees += amt;
      const ft = fp.invoice?.feeStructure?.feeType;
      if (ft) {
        const cur = feesByType.get(ft.feeTypeId) ?? { nameEn: ft.nameEn, nameLo: ft.nameLo, total: 0, count: 0 };
        cur.total += amt;
        cur.count++;
        feesByType.set(ft.feeTypeId, cur);
      }
    }

    // Aggregate Shop Rentals by Shop
    const rentalsByShop = new Map<number, { shopNameEn: string; shopNameLo: string; total: number; count: number }>();
    let totalShopRentals = 0;
    for (const sr of shopRentals) {
      const amt = num(sr.paidAmount);
      totalShopRentals += amt;
      const shop = sr.shop;
      const cur = rentalsByShop.get(shop.shopId) ?? { shopNameEn: shop.shopNameEn, shopNameLo: shop.shopNameLo, total: 0, count: 0 };
      cur.total += amt;
      cur.count++;
      rentalsByShop.set(shop.shopId, cur);
    }

    // Aggregate Payroll Expenses
    let totalPayrollExpense = 0;
    let totalBaseSalary = 0;
    let totalAllowances = 0;
    let totalDeductions = 0;
    let totalPayrollCount = 0;
    for (const period of payrollPeriods) {
      for (const item of period.items) {
        totalPayrollExpense += num(item.netSalary);
        totalBaseSalary += num(item.baseSalary);
        totalAllowances += num(item.totalAllowances);
        totalDeductions += num(item.totalDeductions);
        totalPayrollCount++;
      }
    }

    // Aggregate General Operating Expenses
    const expensesByCategory = new Map<number, { categoryId: number; nameEn: string; nameLo: string; icon?: string | null; total: number; count: number }>();
    let totalGeneralExpense = 0;
    for (const exp of generalExpenses) {
      const amt = num(exp.amount);
      totalGeneralExpense += amt;
      const cat = exp.category;
      if (cat) {
        const cur = expensesByCategory.get(cat.categoryId) ?? {
          categoryId: cat.categoryId,
          nameEn: cat.nameEn,
          nameLo: cat.nameLo,
          icon: cat.icon,
          total: 0,
          count: 0,
        };
        cur.total += amt;
        cur.count++;
        expensesByCategory.set(cat.categoryId, cur);
      }
    }

    const totalIncome = totalStudentFees + totalShopRentals;
    const totalExpense = totalPayrollExpense + totalGeneralExpense;
    const netCashflow = totalIncome - totalExpense;

    return {
      academicYear: academicYear ?? null,
      dateRange: { startDate: startDate ?? null, endDate: endDate ?? null },
      summary: {
        totalIncome,
        totalExpense,
        netCashflow,
        totalStudentFees,
        totalShopRentals,
        totalPayrollExpense,
        totalGeneralExpense,
      },
      breakdown: {
        feesByType: Array.from(feesByType.values()).sort((a, b) => b.total - a.total),
        rentalsByShop: Array.from(rentalsByShop.values()).sort((a, b) => b.total - a.total),
        expensesByCategory: Array.from(expensesByCategory.values()).sort((a, b) => b.total - a.total),
        payroll: {
          totalBaseSalary,
          totalAllowances,
          totalDeductions,
          totalNetSalary: totalPayrollExpense,
          itemCount: totalPayrollCount,
          periodCount: payrollPeriods.length,
        },
      },
    };
  }
}

export default new SchoolReportRepository();
