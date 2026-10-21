import prisma from '../../../infrastructure/database/PrismaClient';
import dispatcher from '../../../infrastructure/notifications/NotificationDispatcher';
import { addDays, schoolDateString, schoolDateValue } from '../../../domain/schoolTime';
import { outstanding } from '../../../domain/fees';
import { feeReminderKind, readFeeReminderSettings } from '../../../domain/feeReminders';

const kip = (n: number) => n.toLocaleString('en-US');
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Sends today's fee reminders to parents (see domain/feeReminders.ts for when).
 * Each invoice records what it was sent, so running this twice in a day — or
 * after a restart — sends nothing new.
 */
class SendFeeReminders {
  async execute(now: Date = new Date()) {
    const row = await prisma.schoolSetting.findUnique({ where: { key: 'feeReminders' } });
    const settings = readFeeReminderSettings(row?.value);
    const today = schoolDateValue(now);

    // Only invoices that could need one: still owing, due within the reminder window or overdue.
    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['unpaid', 'partial'] },
        dueDate: { lte: addDays(today, settings.daysBefore) },
        student: { status: 'active', parentStudents: { some: {} } },
      },
      select: {
        invoiceId: true, invoiceNo: true, studentId: true, status: true, dueDate: true,
        amount: true, discount: true, paidAmount: true,
        reminderBeforeAt: true, overdueReminders: true, lastReminderAt: true,
        student: { select: { fullNameEn: true, fullNameLo: true } },
        feeStructure: { select: { feeType: { select: { nameEn: true, nameLo: true } } } },
      },
    });

    let before = 0;
    let overdue = 0;
    for (const inv of invoices) {
      const kind = feeReminderKind(inv, today, settings);
      if (!kind) continue;

      const owed = outstanding(Number(inv.amount), Number(inv.discount), Number(inv.paidAmount));
      if (owed <= 0) continue;
      const due = ymd(inv.dueDate);
      const fee = { en: inv.feeStructure.feeType.nameEn, lo: inv.feeStructure.feeType.nameLo || inv.feeStructure.feeType.nameEn };
      const name = { en: inv.student.fullNameEn, lo: inv.student.fullNameLo || inv.student.fullNameEn };
      const daysLate = Math.round((today.getTime() - inv.dueDate.getTime()) / 86400000);

      const [messageEn, messageLo] = kind === 'before'
        ? [
          `Reminder: ${fee.en} for ${name.en} (${inv.invoiceNo}) is due on ${due}. Amount still owed: ${kip(owed)} LAK.`,
          `ແຈ້ງເຕືອນ: ${fee.lo} ຂອງ ${name.lo} (${inv.invoiceNo}) ຄົບກຳນົດຈ່າຍວັນທີ ${due}. ຍອດທີ່ຍັງຄ້າງ: ${kip(owed)} ກີບ.`,
        ]
        : [
          `Overdue: ${fee.en} for ${name.en} (${inv.invoiceNo}) was due on ${due} (${daysLate} days ago). Amount still owed: ${kip(owed)} LAK. Please pay at the school office.`,
          `ກາຍກຳນົດ: ${fee.lo} ຂອງ ${name.lo} (${inv.invoiceNo}) ຄົບກຳນົດວັນທີ ${due} (ກາຍມາ ${daysLate} ມື້). ຍອດທີ່ຍັງຄ້າງ: ${kip(owed)} ກີບ. ກະລຸນາຊຳລະທີ່ຫ້ອງການໂຮງຮຽນ.`,
        ];

      // Recorded first, so a crash after notifying cannot cause a second reminder.
      await prisma.invoice.update({
        where: { invoiceId: inv.invoiceId },
        data: kind === 'before'
          ? { reminderBeforeAt: now, lastReminderAt: now }
          : { overdueReminders: { increment: 1 }, lastReminderAt: now },
      });
      await dispatcher.notifyParents(inv.studentId, 'fee', messageEn, messageLo);
      if (kind === 'before') before++;
      else overdue++;
    }

    return { date: schoolDateString(now), before, overdue };
  }
}

export default SendFeeReminders;
