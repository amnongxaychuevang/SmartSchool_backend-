import prisma from '../../../infrastructure/database/PrismaClient';
import { schoolDateValue } from '../../../domain/schoolTime';

/**
 * Queues an absence notice for every parent linked to the student, for one
 * school date. The rows are created with status "pending" (queued): delivery
 * is the notification worker's job, so the report never claims "sent" early.
 * The message names the date, which is how the report finds it again.
 */
class NotifyAbsence {
  async execute(studentId: number, date: string) {
    const record = await prisma.dailyAttendance.findUnique({
      where: { studentId_date: { studentId, date: schoolDateValue(date) } },
      select: { status: true },
    });
    const status = record?.status ?? 'unrecorded';
    if (status === 'present' || status === 'late') {
      throw Object.assign(new Error('Student was in school on that date'), { statusCode: 409 });
    }

    const student = await prisma.student.findUnique({
      where: { studentId },
      select: { fullNameEn: true, fullNameLo: true, parentStudents: { select: { parentUserId: true } } },
    });
    if (!student) throw Object.assign(new Error('Student not found'), { statusCode: 404 });
    if (!student.parentStudents.length) {
      throw Object.assign(new Error('No parent is linked to this student'), { statusCode: 422 });
    }

    const existing = await prisma.notification.count({
      where: { studentId, type: 'absence', messageEn: { contains: date } },
    });
    if (existing) throw Object.assign(new Error('Parents were already notified for this date'), { statusCode: 409 });

    const excused = status === 'excused';
    await prisma.notification.createMany({
      data: student.parentStudents.map((link) => ({
        recipientUserId: link.parentUserId,
        studentId,
        type: 'absence' as const,
        channel: 'app_push' as const,
        status: 'pending' as const,
        messageEn: excused
          ? `${student.fullNameEn} is on approved leave on ${date}.`
          : `${student.fullNameEn} was not at school on ${date}. Please contact the homeroom teacher.`,
        messageLo: excused
          ? `${student.fullNameLo} ລາພັກ (ອະນຸມັດແລ້ວ) ໃນວັນທີ ${date}.`
          : `${student.fullNameLo} ບໍ່ໄດ້ມາໂຮງຮຽນໃນວັນທີ ${date}. ກະລຸນາຕິດຕໍ່ຄູປະຈຳຫ້ອງ.`,
      })),
    });

    return { studentId, date, recipients: student.parentStudents.length, notification: 'pending' as const };
  }
}

export default NotifyAbsence;
