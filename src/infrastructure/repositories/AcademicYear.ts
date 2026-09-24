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

// Prisma filter for a student's current enrolment: this year's class, not left.
export async function currentEnrolmentWhere() {
  return { leftAt: null, class: { academicYear: await getCurrentAcademicYear() } };
}
