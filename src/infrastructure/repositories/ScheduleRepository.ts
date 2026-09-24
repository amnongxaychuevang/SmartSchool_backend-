import prisma from '../database/PrismaClient';

// A timetable slot belongs to a ClassSubject; responses keep the flat
// `class` / `subject` / `teacher` fields the screens already use.
export const scheduleInclude = {
  classSubject: {
    select: {
      classId: true,
      subjectId: true,
      teacherId: true,
      class: { select: { classNameEn: true, classNameLo: true } },
      subject: { select: { subjectId: true, subjectCode: true, subjectNameEn: true, subjectNameLo: true } },
      teacher: { select: { fullNameEn: true, fullNameLo: true } },
    },
  },
};

export function flattenSchedule(row) {
  const { classSubject, ...rest } = row;
  return {
    ...rest,
    classId: classSubject.classId,
    subjectId: classSubject.subjectId,
    teacherId: classSubject.teacherId,
    class: classSubject.class,
    subject: classSubject.subject,
    teacher: classSubject.teacher,
  };
}

class ScheduleRepository {
  async findMany({ teacherId, classId, termId, dayOfWeek }: any = {}) {
    const rows = await prisma.schedule.findMany({
      where: {
        ...(dayOfWeek !== undefined ? { dayOfWeek: parseInt(dayOfWeek) } : {}),
        classSubject: {
          ...(teacherId ? { teacherId: parseInt(teacherId) } : {}),
          ...(classId ? { classId: parseInt(classId) } : {}),
          ...(termId ? { termId: parseInt(termId) } : {}),
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      include: scheduleInclude,
    });
    return rows.map(flattenSchedule);
  }
}

export default new ScheduleRepository();
