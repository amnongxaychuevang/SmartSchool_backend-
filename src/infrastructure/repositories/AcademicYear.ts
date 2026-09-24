import prisma from '../database/PrismaClient';
import { academicYearForDate } from '../../domain/schoolTime';

// The academic year of the active term, or the calendar-based year if no term is active.
export async function getCurrentAcademicYear(): Promise<string> {
  const term = await prisma.academicTerm.findFirst({
    where: { status: 'active' },
    orderBy: { startDate: 'desc' },
    select: { academicYear: true },
  });
  return term?.academicYear ?? academicYearForDate();
}

// The active term's id, or null if none is active.
export async function getCurrentTermId(): Promise<number | null> {
  const term = await prisma.academicTerm.findFirst({
    where: { status: 'active' },
    orderBy: { startDate: 'desc' },
    select: { termId: true },
  });
  return term?.termId ?? null;
}

// Classes a teacher works with this year: homeroom classes plus classes they teach
// a subject to in the active term.
export async function teacherClassesWhere(teacherUserId: number) {
  return {
    academicYear: await getCurrentAcademicYear(),
    OR: [
      { homeroomTeacherId: teacherUserId },
      { classSubjects: { some: { teacherId: teacherUserId, term: { status: 'active' as const } } } },
    ],
  };
}

export async function teacherHasClass(teacherUserId: number, classId: number): Promise<boolean> {
  const count = await prisma.class.count({ where: { classId, ...(await teacherClassesWhere(teacherUserId)) } });
  return count > 0;
}

// Prisma filter for a student's current enrolment: this year's class, not left.
export async function currentEnrolmentWhere() {
  return { leftAt: null, class: { academicYear: await getCurrentAcademicYear() } };
}
