import prisma from '../database/PrismaClient';
import { getCurrentTermId } from './AcademicYear';

const include = {
  class: { select: { classId: true, classNameEn: true, classNameLo: true, academicYear: true } },
  subject: { select: { subjectId: true, subjectCode: true, subjectNameEn: true, subjectNameLo: true } },
  teacher: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
  term: { select: { termId: true, termNameEn: true, termNameLo: true, academicYear: true, status: true } },
};

const httpError = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

class ClassSubjectRepository {
  async findMany({ classId, subjectId, teacherId, termId }: any = {}) {
    return prisma.classSubject.findMany({
      where: {
        ...(classId ? { classId: Number(classId) } : {}),
        ...(subjectId ? { subjectId: Number(subjectId) } : {}),
        ...(teacherId ? { teacherId: Number(teacherId) } : {}),
        ...(termId ? { termId: Number(termId) } : {}),
      },
      include,
      orderBy: [{ classId: 'asc' }, { subject: { subjectNameEn: 'asc' } }],
    });
  }

  async findById(id: number) {
    return prisma.classSubject.findUnique({ where: { id }, include });
  }

  /**
   * The ClassSubject for (class, subject) in `termId`, or in the active term when
   * no term is given. Lets clients keep sending classId + subjectId.
   */
  async resolve(classId: number, subjectId: number, termId?: number) {
    const term = termId ?? (await getCurrentTermId());
    if (!term) throw httpError('No active academic term — set one in Settings → Academic terms', 400);
    const row = await prisma.classSubject.findUnique({
      where: { classId_subjectId_termId: { classId, subjectId, termId: term } },
    });
    if (!row) throw httpError('This subject is not assigned to this class for the term', 400);
    return row;
  }

  async create(data: { classId: number; subjectId: number; termId?: number; teacherId?: number | null }) {
    const termId = data.termId ?? (await getCurrentTermId());
    if (!termId) throw httpError('No active academic term — pass termId or activate a term', 400);
    try {
      return await prisma.classSubject.create({
        data: { classId: data.classId, subjectId: data.subjectId, termId, teacherId: data.teacherId ?? null },
        include,
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'P2002') throw httpError('This subject is already assigned to this class for the term', 409);
      if (code === 'P2003') throw httpError('Class, subject, term or teacher does not exist (the teacher must be a Teacher)', 400);
      throw err;
    }
  }

  async setTeacher(id: number, teacherId: number | null) {
    try {
      return await prisma.classSubject.update({ where: { id }, data: { teacherId }, include });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2003') throw httpError('The teacher must be a Teacher account', 400);
      throw err;
    }
  }

  async delete(id: number) {
    try {
      return await prisma.classSubject.delete({ where: { id } });
    } catch (err) {
      // Grades reference it (onDelete: Restrict) — those records must not vanish.
      if ((err as { code?: string }).code === 'P2003') throw httpError('This class subject already has grades and cannot be removed', 409);
      throw err;
    }
  }
}

export default new ClassSubjectRepository();
