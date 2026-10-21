import { Prisma } from '@prisma/client';
import prisma from '../database/PrismaClient';
import dispatcher from '../notifications/NotificationDispatcher';
import { schoolDateValue } from '../../domain/schoolTime';
import { teacherClassesWhere } from './AcademicYear';

const include = {
  class: { select: { classId: true, classNameEn: true, classNameLo: true } },
  subject: { select: { subjectId: true, subjectNameEn: true, subjectNameLo: true } },
  creator: { select: { fullNameEn: true, fullNameLo: true } },
} satisfies Prisma.AssignmentInclude;

export interface AssignmentInput {
  classId: number;
  subjectId?: number | null;
  title: string;
  description?: string | null;
  dueDate: string;
}

export class AssignmentRepository {
  /** when: 'upcoming' = due today or later (soonest first), 'past' = already due (latest first). */
  async list(query: { classId?: number; teacherUserId?: number; when?: 'upcoming' | 'past'; page: number; limit: number }) {
    const today = schoolDateValue();
    const where: Prisma.AssignmentWhereInput = {
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.teacherUserId ? { class: await teacherClassesWhere(query.teacherUserId) } : {}),
      ...(query.when === 'past' ? { dueDate: { lt: today } } : query.when === 'upcoming' ? { dueDate: { gte: today } } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.assignment.findMany({
        where,
        include,
        orderBy: { dueDate: query.when === 'past' ? 'desc' : 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.assignment.count({ where }),
    ]);
    return { data, meta: { total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) } };
  }

  async findById(assignmentId: number) {
    return prisma.assignment.findUnique({ where: { assignmentId }, include });
  }

  async create(input: AssignmentInput, createdBy: number) {
    const assignment = await prisma.assignment.create({
      data: {
        classId: input.classId,
        subjectId: input.subjectId ?? null,
        title: input.title,
        description: input.description || null,
        dueDate: schoolDateValue(input.dueDate),
        createdBy,
      },
      include,
    });
    this.notifyClassParents(assignment).catch((err) => console.error('[Assignment] Parent notification error:', err));
    return assignment;
  }

  async update(assignmentId: number, input: Partial<AssignmentInput>) {
    return prisma.assignment.update({
      where: { assignmentId },
      data: {
        ...(input.classId !== undefined ? { classId: input.classId } : {}),
        ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.dueDate !== undefined ? { dueDate: schoolDateValue(input.dueDate) } : {}),
      },
      include,
    });
  }

  async delete(assignmentId: number) {
    return prisma.assignment.delete({ where: { assignmentId } });
  }

  /** Homework for the class the student is in now, upcoming first. */
  async listForStudent(studentId: number) {
    const enrolment = await prisma.classStudent.findFirst({
      where: { studentId, leftAt: null },
      orderBy: { enrolledAt: 'desc' },
      select: { classId: true },
    });
    if (!enrolment) return [];
    const today = schoolDateValue();
    const [upcoming, past] = await Promise.all([
      prisma.assignment.findMany({ where: { classId: enrolment.classId, dueDate: { gte: today } }, include, orderBy: { dueDate: 'asc' } }),
      prisma.assignment.findMany({ where: { classId: enrolment.classId, dueDate: { lt: today } }, include, orderBy: { dueDate: 'desc' }, take: 30 }),
    ]);
    return [...upcoming, ...past];
  }

  private async notifyClassParents(a: { classId: number; title: string; dueDate: Date; subject: { subjectNameEn: string; subjectNameLo: string } | null }) {
    const students = await prisma.classStudent.findMany({ where: { classId: a.classId, leftAt: null }, select: { studentId: true } });
    const due = a.dueDate.toISOString().slice(0, 10);
    const subjectEn = a.subject ? ` (${a.subject.subjectNameEn})` : '';
    const subjectLo = a.subject ? ` (${a.subject.subjectNameLo})` : '';
    for (const s of students) {
      await dispatcher.notifyParents(
        s.studentId,
        'general',
        `New homework${subjectEn}: "${a.title}", due ${due}.`,
        `ວຽກບ້ານໃໝ່${subjectLo}: "${a.title}", ກຳນົດສົ່ງ ${due}.`,
      );
    }
  }
}

export default new AssignmentRepository();
