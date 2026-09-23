import prisma from '../database/PrismaClient';

class ScheduleRepository {
  async findMany({ teacherId, classId, dayOfWeek }: any = {}) {
    const where: any = {};
    if (teacherId) where.teacherId = parseInt(teacherId);
    if (classId) where.classId = parseInt(classId);
    if (dayOfWeek !== undefined) where.dayOfWeek = parseInt(dayOfWeek);

    return prisma.schedule.findMany({
      where,
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' }
      ],
      include: {
        class: { select: { classNameEn: true, classNameLo: true } },
        subject: { select: { subjectNameEn: true, subjectNameLo: true } },
        teacher: { select: { fullNameEn: true, fullNameLo: true } }
      }
    });
  }
}

export default new ScheduleRepository();
