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

  /** Homework for the class the student is in now, upcoming first, including student's own submission. */
  async listForStudent(studentId: number) {
    const enrolment = await prisma.classStudent.findFirst({
      where: { studentId, leftAt: null },
      orderBy: { enrolledAt: 'desc' },
      select: { classId: true },
    });
    if (!enrolment) return [];
    const today = schoolDateValue();
    const studentInclude = {
      ...include,
      submissions: {
        where: { studentId },
        take: 1,
      },
    };
    const [upcoming, past] = await Promise.all([
      prisma.assignment.findMany({ where: { classId: enrolment.classId, dueDate: { gte: today } }, include: studentInclude, orderBy: { dueDate: 'asc' } }),
      prisma.assignment.findMany({ where: { classId: enrolment.classId, dueDate: { lt: today } }, include: studentInclude, orderBy: { dueDate: 'desc' }, take: 30 }),
    ]);
    return [...upcoming, ...past].map((a) => ({
      ...a,
      mySubmission: a.submissions?.[0] || null,
    }));
  }

  /** Submit homework for a student (creates or updates submission). */
  async submit(data: { assignmentId: number; studentId: number; fileUrl: string; fileName?: string; fileSize?: number }) {
    const assignment = await prisma.assignment.findUnique({ where: { assignmentId: data.assignmentId } });
    if (!assignment) throw Object.assign(new Error('Assignment not found'), { statusCode: 404 });

    const today = schoolDateValue();
    const isLate = assignment.dueDate < today;

    return prisma.assignmentSubmission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId: data.assignmentId,
          studentId: data.studentId,
        },
      },
      create: {
        assignmentId: data.assignmentId,
        studentId: data.studentId,
        fileUrl: data.fileUrl,
        fileName: data.fileName || null,
        fileSize: data.fileSize || null,
        status: isLate ? 'late' : 'submitted',
      },
      update: {
        fileUrl: data.fileUrl,
        fileName: data.fileName || null,
        fileSize: data.fileSize || null,
        submittedAt: new Date(),
        status: isLate ? 'late' : 'submitted',
      },
      include: {
        student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true, photoUrl: true } },
      },
    });
  }

  /** List all submissions for an assignment (for teachers to review). */
  async listSubmissions(assignmentId: number) {
    const assignment = await prisma.assignment.findUnique({
      where: { assignmentId },
      include: {
        class: {
          include: {
            classStudents: {
              where: { leftAt: null },
              include: {
                student: {
                  select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true, photoUrl: true, gender: true },
                },
              },
            },
          },
        },
        submissions: {
          include: {
            student: {
              select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true, photoUrl: true },
            },
            grader: {
              select: { userId: true, fullNameEn: true, fullNameLo: true },
            },
          },
        },
      },
    });
    if (!assignment) throw Object.assign(new Error('Assignment not found'), { statusCode: 404 });

    type SubmissionItem = (typeof assignment.submissions)[number];
    const submissionsByStudentId = new Map<number, SubmissionItem>(
      assignment.submissions.map((s) => [s.studentId, s])
    );

    // Return all enrolled students in the class with their submission status
    const allStudents = assignment.class.classStudents.map((cs) => {
      const sub = submissionsByStudentId.get(cs.studentId);
      return {
        student: cs.student,
        submission: sub || null,
        isSubmitted: !!sub,
        status: sub ? sub.status : 'missing',
      };
    });

    return {
      assignment: {
        assignmentId: assignment.assignmentId,
        title: assignment.title,
        dueDate: assignment.dueDate,
        classId: assignment.classId,
      },
      totalStudents: allStudents.length,
      submittedCount: assignment.submissions.length,
      gradedCount: assignment.submissions.filter((s) => s.status === 'graded').length,
      students: allStudents,
    };
  }

  /** Grade an assignment submission and notify parents. */
  async gradeSubmission(submissionId: number, data: { score: number; maxScore?: number; feedback?: string }, gradedBy: number) {
    const submission = await prisma.assignmentSubmission.findUnique({
      where: { submissionId },
      include: {
        assignment: { select: { title: true } },
        student: { select: { studentId: true, fullNameEn: true, fullNameLo: true } },
      },
    });
    if (!submission) throw Object.assign(new Error('Submission not found'), { statusCode: 404 });

    const maxScore = data.maxScore ?? (submission.maxScore ? Number(submission.maxScore) : 100);
    const updated = await prisma.assignmentSubmission.update({
      where: { submissionId },
      data: {
        score: data.score,
        maxScore,
        feedback: data.feedback || null,
        status: 'graded',
        gradedBy,
        gradedAt: new Date(),
      },
      include: {
        student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true, photoUrl: true } },
        grader: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
      },
    });

    // Notify parents of the student
    dispatcher.notifyParents(
      submission.studentId,
      'general',
      `Homework graded: "${submission.assignment.title}" — Score: ${data.score}/${maxScore}${data.feedback ? ` ("${data.feedback}")` : ''}`,
      `ກວດວຽກບ້ານແລ້ວ: "${submission.assignment.title}" — ຄະແນນ: ${data.score}/${maxScore}${data.feedback ? ` ("${data.feedback}")` : ''}`,
    ).catch((err) => console.error('[Assignment] Grading notification error:', err));

    return updated;
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
