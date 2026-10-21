import prisma from '../database/PrismaClient';
import { amountDue } from '../../domain/fees';

const fail = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });
const num = (v: unknown) => Number(v ?? 0);

const studentSelect = {
  studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true,
  classStudents: {
    where: { leftAt: null }, orderBy: { enrolledAt: 'desc' as const }, take: 1,
    select: { class: { select: { classNameEn: true, classNameLo: true } } },
  },
};

type StudentRow = {
  studentId: number; studentCode: string; fullNameEn: string; fullNameLo: string;
  classStudents: { class: { classNameEn: string; classNameLo: string } }[];
};

const presentStudent = ({ classStudents, ...s }: StudentRow) => ({ ...s, class: classStudents[0]?.class ?? null });

/** The school's own details (Settings → school info), printed at the top of a receipt. */
async function schoolInfo() {
  const row = await prisma.schoolSetting.findUnique({ where: { key: 'schoolInfo' } });
  const v = (row?.value ?? {}) as Record<string, string | undefined>;
  return {
    nameEn: v.schoolNameEn ?? '', nameLo: v.schoolNameLo ?? '',
    addressEn: v.addressEn ?? '', addressLo: v.addressLo ?? '',
    phone: v.contactPhone ?? '', email: v.contactEmail ?? '',
  };
}

/**
 * Receipts for money the school received: a fee payment, or a wallet top-up.
 * Each returns the student it belongs to, so the caller can check a parent's link.
 */
class ReceiptRepository {
  async feePayment(paymentId: number) {
    const payment = await prisma.feePayment.findUnique({
      where: { paymentId },
      include: {
        receiver: { select: { fullNameEn: true, fullNameLo: true } },
        invoice: {
          include: {
            student: { select: studentSelect },
            feeStructure: {
              select: {
                academicYear: true,
                feeType: { select: { nameEn: true, nameLo: true } },
                term: { select: { termNameEn: true, termNameLo: true } },
              },
            },
            payments: { select: { paymentId: true, amount: true, paidAt: true } },
          },
        },
      },
    });
    if (!payment) throw fail('Receipt not found', 404);

    const inv = payment.invoice;
    const due = amountDue(num(inv.amount), num(inv.discount));
    // What had been paid once this payment came in — a receipt shows that moment, not today's total.
    const paidUpTo = inv.payments
      .filter((p) => p.paidAt < payment.paidAt || (p.paidAt.getTime() === payment.paidAt.getTime() && p.paymentId <= payment.paymentId))
      .reduce((sum, p) => sum + num(p.amount), 0);

    return {
      kind: 'fee' as const,
      receiptNo: payment.receiptNo,
      date: payment.paidAt,
      amount: num(payment.amount),
      method: payment.method,
      referenceNo: payment.referenceNo,
      receivedBy: payment.receiver,
      student: presentStudent(inv.student),
      school: await schoolInfo(),
      fee: {
        invoiceNo: inv.invoiceNo,
        feeTypeEn: inv.feeStructure.feeType.nameEn,
        feeTypeLo: inv.feeStructure.feeType.nameLo,
        academicYear: inv.feeStructure.academicYear,
        termEn: inv.feeStructure.term?.termNameEn ?? null,
        termLo: inv.feeStructure.term?.termNameLo ?? null,
        amountDue: due,
        paidToDate: paidUpTo,
        outstanding: Math.max(due - paidUpTo, 0),
      },
    };
  }

  async topUp(transactionId: number) {
    const tx = await prisma.walletTransaction.findUnique({
      where: { transactionId },
      include: {
        processor: { select: { fullNameEn: true, fullNameLo: true } },
        wallet: { select: { student: { select: studentSelect } } },
        topUpRequest: { select: { method: true, slipUrl: true } },
      },
    });
    if (!tx || tx.transactionType !== 'top_up') throw fail('Receipt not found', 404);

    return {
      kind: 'topup' as const,
      receiptNo: tx.referenceNo ?? `TU-${tx.transactionId}`,
      date: tx.createdAt,
      amount: num(tx.amount),
      // A parent's request carries how they paid; a top-up entered at the office was cash.
      method: tx.topUpRequest?.method ?? 'cash',
      referenceNo: null,
      receivedBy: tx.processor,
      student: presentStudent(tx.wallet.student),
      school: await schoolInfo(),
      topup: { balanceBefore: num(tx.balanceBefore), balanceAfter: num(tx.balanceAfter) },
    };
  }
}

export default new ReceiptRepository();
