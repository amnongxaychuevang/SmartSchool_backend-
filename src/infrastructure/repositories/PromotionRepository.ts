import prisma from '../database/PrismaClient';
import { byGradeOrder } from '../../domain/gradeOrder';

const httpError = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

export type PromotionMove =
  | { studentId: number; action: 'move'; toClassId: number } // next grade, or the same grade again (repeat)
  | { studentId: number; action: 'graduate' }
  | { studentId: number; action: 'transfer' };

/**
 * Year-end promotion: every student of one school year goes to a class of the
 * next year, graduates or leaves.
 *
 * The old year's enrolment is NOT closed: it stays as the record of where the
 * student finished that year (last year's reports and report cards read it).
 * The new year is a new enrolment row, so "current class" (scoped to the
 * current academic year) switches once the new year's term is made active.
 */
class PromotionRepository {
  /** The classes of both years, with the students still in each `fromYear` class. */
  async preview(fromYear: string, toYear: string) {
    const [fromClasses, toClasses] = await Promise.all([
      prisma.class.findMany({
        where: { academicYear: fromYear },
        select: {
          classId: true, classNameEn: true, classNameLo: true, gradeLevelEn: true, gradeLevelLo: true,
          classStudents: {
            where: { leftAt: null, student: { status: 'active' } },
            orderBy: { student: { fullNameLo: 'asc' } },
            select: { student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } } },
          },
        },
      }),
      prisma.class.findMany({
        where: { academicYear: toYear },
        select: { classId: true, classNameEn: true, classNameLo: true, gradeLevelEn: true, gradeLevelLo: true },
      }),
    ]);

    // Students who already have a class next year (promoted earlier) are shown as done.
    const studentIds = fromClasses.flatMap((c) => c.classStudents.map((cs) => cs.student.studentId));
    const already = await prisma.classStudent.findMany({
      where: { studentId: { in: studentIds }, leftAt: null, class: { academicYear: toYear } },
      select: { studentId: true, classId: true },
    });
    const placed = new Map(already.map((a) => [a.studentId, a.classId]));

    return {
      fromYear,
      toYear,
      fromClasses: fromClasses.sort(byGradeOrder).map(({ classStudents, ...cls }) => ({
        ...cls,
        students: classStudents.map(({ student }) => ({ ...student, placedInClassId: placed.get(student.studentId) ?? null })),
      })),
      toClasses: toClasses.sort(byGradeOrder),
    };
  }

  /** Applies all moves in one transaction: either every student is promoted or none is. */
  async apply(fromYear: string, toYear: string, moves: PromotionMove[]) {
    if (fromYear === toYear) throw httpError('The new year must be different from the old one', 400);
    const ids = moves.map((m) => m.studentId);
    if (new Set(ids).size !== ids.length) throw httpError('A student appears twice', 400);

    return prisma.$transaction(async (tx) => {
      const enrolled = await tx.classStudent.findMany({
        where: { studentId: { in: ids }, leftAt: null, class: { academicYear: fromYear }, student: { status: 'active' } },
        select: { studentId: true },
      });
      const enrolledIds = new Set(enrolled.map((e) => e.studentId));
      const outsiders = ids.filter((id) => !enrolledIds.has(id));
      if (outsiders.length) throw httpError(`Not active students of ${fromYear}: ${outsiders.join(', ')}`, 400);

      const targetIds = [...new Set(moves.flatMap((m) => (m.action === 'move' ? [m.toClassId] : [])))];
      const targets = await tx.class.findMany({ where: { classId: { in: targetIds } }, select: { classId: true, academicYear: true } });
      const wrongYear = targetIds.filter((id) => targets.find((t) => t.classId === id)?.academicYear !== toYear);
      if (wrongYear.length) throw httpError(`Classes not in ${toYear}: ${wrongYear.join(', ')}`, 400);

      const placed = await tx.classStudent.findMany({
        where: { studentId: { in: ids }, leftAt: null, class: { academicYear: toYear } },
        select: { studentId: true },
      });
      if (placed.length) {
        throw httpError(`Already in a ${toYear} class: ${placed.map((p) => p.studentId).join(', ')}`, 409);
      }

      const now = new Date();
      const move = moves.filter((m): m is Extract<PromotionMove, { action: 'move' }> => m.action === 'move');
      if (move.length) {
        await tx.classStudent.createMany({ data: move.map((m) => ({ classId: m.toClassId, studentId: m.studentId, enrolledAt: now })) });
      }
      const graduated = moves.filter((m) => m.action === 'graduate').map((m) => m.studentId);
      if (graduated.length) await tx.student.updateMany({ where: { studentId: { in: graduated } }, data: { status: 'graduated' } });
      const transferred = moves.filter((m) => m.action === 'transfer').map((m) => m.studentId);
      if (transferred.length) await tx.student.updateMany({ where: { studentId: { in: transferred } }, data: { status: 'transferred' } });

      // A student who left can no longer tap in or pay: the gate and the POS only look at the card.
      const leaving = [...graduated, ...transferred];
      const cards = leaving.length
        ? await tx.card.updateMany({ where: { studentId: { in: leaving }, status: 'active' }, data: { status: 'deactivated' } })
        : { count: 0 };

      return { moved: move.length, graduated: graduated.length, transferred: transferred.length, cardsDeactivated: cards.count };
    });
  }
}

export default new PromotionRepository();
