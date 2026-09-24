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

  async create(data: SlotInput) {
    const slot = await validateSlot(data);
    const row = await prisma.schedule.create({ data: slot, include: scheduleInclude });
    return flattenSchedule(row);
  }

  async update(scheduleId: number, data: SlotInput) {
    const slot = await validateSlot(data, scheduleId);
    const row = await prisma.schedule.update({ where: { scheduleId }, data: slot, include: scheduleInclude });
    return flattenSchedule(row);
  }

  async delete(scheduleId: number) {
    return prisma.schedule.delete({ where: { scheduleId } });
  }
}

type SlotInput = { classSubjectId: number; dayOfWeek: number; startTime: string; endTime: string; roomNumber?: string | null };

const httpError = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

// "HH:MM" <-> the Date Prisma uses for @db.Time (a time of day on 1970-01-01, UTC).
const toTime = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const hhmm = (d: Date) => d.toISOString().slice(11, 16);

/**
 * Rejects a slot that ends before it starts, or that overlaps another slot in the
 * same term for the same class, the same teacher or the same room.
 */
async function validateSlot(data: SlotInput, ignoreScheduleId?: number) {
  const startTime = toTime(data.startTime);
  const endTime = toTime(data.endTime);
  if (endTime <= startTime) throw httpError('End time must be after start time', 400);

  const cs = await prisma.classSubject.findUnique({ where: { id: data.classSubjectId } });
  if (!cs) throw httpError('Class subject not found', 400);

  const roomNumber = data.roomNumber?.trim() || null;
  const clashes = await prisma.schedule.findMany({
    where: {
      ...(ignoreScheduleId ? { scheduleId: { not: ignoreScheduleId } } : {}),
      dayOfWeek: data.dayOfWeek,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      classSubject: { termId: cs.termId },
      OR: [
        { classSubject: { classId: cs.classId } },
        ...(cs.teacherId ? [{ classSubject: { teacherId: cs.teacherId } }] : []),
        ...(roomNumber ? [{ roomNumber }] : []),
      ],
    },
    include: scheduleInclude,
  });
  if (clashes.length > 0) {
    const c = flattenSchedule(clashes[0]);
    const what = c.classId === cs.classId ? 'this class' : c.teacherId && c.teacherId === cs.teacherId ? 'this teacher' : `room ${roomNumber}`;
    throw httpError(
      `Time clash for ${what}: ${c.subject.subjectNameEn} (${c.class.classNameEn}) ${hhmm(c.startTime)}–${hhmm(c.endTime)}`,
      409,
    );
  }
  return { classSubjectId: data.classSubjectId, dayOfWeek: data.dayOfWeek, startTime, endTime, roomNumber };
}

export default new ScheduleRepository();
