import prisma from '../database/PrismaClient';
import { currentEnrolmentWhere, getCurrentAcademicYear } from './AcademicYear';
import { ADDRESS_INCLUDE, checkAddress } from './Address';
import { documentNo } from '../../domain/fees';

class StudentRepository {
  /**
   * Get paginated list of students with optional search
   */
  /** The list filters (search, status, class, gender) as a Prisma where — used by the list and its export. */
  async listWhere({ search = '', status, classId, gender }: any = {}) {
    return {
      ...(status ? { status } : {}),
      ...(gender ? { gender } : {}),
      ...(classId
        ? { classStudents: { some: { classId: parseInt(classId), ...(await currentEnrolmentWhere()) } } }
        : {}),
      ...(search
        ? {
            OR: [
              { fullNameEn: { contains: search } },
              { fullNameLo: { contains: search } },
              { studentCode: { contains: search } },
            ],
          }
        : {}),
    };
  }

  async findMany({ search = '', page = 1, limit = 20, status, classId, gender }: any = {}) {
    const skip = (page - 1) * limit;
    const where = await this.listWhere({ search, status, classId, gender });

    const enrolment = await currentEnrolmentWhere();
    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          // Only this year's class; [0] used to be whichever enrolment came first (possibly last year's).
          classStudents: {
            where: enrolment,
            include: { class: { select: { classNameEn: true, classNameLo: true } } },
            take: 1,
          },
          parentStudents: {
            include: { parent: { select: { userId: true, fullNameEn: true, fullNameLo: true, phoneNumber: true } } },
            take: 1, // Only need the primary or first parent for the table
          },
          ...ADDRESS_INCLUDE,
        },
      }),
      prisma.student.count({ where }),
    ]);

    return { students, total, page, limit };
  }

  /** Full record for the edit form: current class and linked parents. */
  async findById(studentId) {
    return prisma.student.findUnique({
      where: { studentId: parseInt(studentId) },
      include: {
        classStudents: {
          where: await currentEnrolmentWhere(),
          include: { class: { select: { classId: true, classNameEn: true, classNameLo: true } } },
          take: 1,
        },
        parentStudents: {
          include: { parent: { select: { userId: true, fullNameEn: true, fullNameLo: true, phoneNumber: true } } },
        },
        ...ADDRESS_INCLUDE,
      },
    });
  }

  /**
   * Creates/updates the student together with their current class and parent links,
   * all in one transaction. `classId` (null = no class) and `parents` are optional:
   * leaving one out keeps what is there.
   */
  async create({ classId, parents, feeStructureId, issuedBy, ...student }: StudentWrite & { feeStructureId?: number; issuedBy?: number }) {
    // Two admins saving at the same instant can compute the same next code; the
    // unique index rejects the second, so recompute and try again.
    for (let attempt = 1; ; attempt++) {
      try {
        const studentId = await prisma.$transaction(async (tx) => {
          await checkAddress(tx, student);
          const studentCode = await nextStudentCode(tx);
          const created = await tx.student.create({ data: { ...student, studentCode, status: 'active' } });
          if (classId) await setCurrentClass(tx, created.studentId, classId);
          if (parents) await setParents(tx, created.studentId, parents);

          if (feeStructureId) {
            const fee = await tx.feeStructure.findUnique({ where: { feeStructureId: Number(feeStructureId) } });
            if (fee) {
              const year = Number(fee.academicYear.slice(0, 4)) || new Date().getFullYear();
              const inv = await tx.invoice.create({
                data: {
                  invoiceNo: `TMP-${feeStructureId}-${created.studentId}`,
                  studentId: created.studentId,
                  feeStructureId: Number(feeStructureId),
                  amount: fee.amount,
                  dueDate: fee.dueDate,
                  issuedBy: issuedBy ? Number(issuedBy) : null,
                },
              });
              await tx.invoice.update({
                where: { invoiceId: inv.invoiceId },
                data: { invoiceNo: documentNo('INV', year, inv.invoiceId) },
              });
            }
          }

          return created.studentId;
        });
        return this.findById(studentId);
      } catch (err) {
        // A brand-new row can only clash on student_code (its class/parent links are new too).
        if (err?.code !== 'P2002' || attempt >= 5) throw err;
      }
    }
  }

  async setPhoto(studentId: number, photoUrl: string | null) {
    await prisma.student.update({ where: { studentId }, data: { photoUrl } });
    return this.findById(studentId);
  }

  async update(studentId, { classId, parents, ...student }: StudentWrite) {
    const id = parseInt(studentId);
    await prisma.$transaction(async (tx) => {
      await checkAddress(tx, student, async () =>
        (await tx.student.findUnique({ where: { studentId: id }, select: { districtId: true } }))?.districtId);
      if (Object.keys(student).length > 0) await tx.student.update({ where: { studentId: id }, data: student });
      if (classId !== undefined) await setCurrentClass(tx, id, classId);
      if (parents) await setParents(tx, id, parents);
    });
    return this.findById(id);
  }
}

type ParentLink = { parentUserId: number; relationship?: string; isPrimaryContact?: boolean };
type StudentWrite = Record<string, unknown> & { classId?: number | null; parents?: ParentLink[] };


/** STU-<year>-<4-digit sequence>, restarting at 0001 each calendar year. */
export async function nextStudentCode(tx, now = new Date()) {
  const prefix = `STU-${now.getFullYear()}-`;
  // Compare numerically: as text "STU-2026-9999" sorts after "STU-2026-10000", and
  // older hand-typed codes may use 3 digits ("STU-2026-001").
  const rows = await tx.student.findMany({
    where: { studentCode: { startsWith: prefix } },
    select: { studentCode: true },
  });
  const lastSeq = rows.reduce((max, r) => Math.max(max, parseInt(r.studentCode.slice(prefix.length), 10) || 0), 0);
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
}

const httpError = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

/**
 * Enrols the student in `classId` for the current academic year. A previous class
 * this year is closed with leftAt (kept as history), so there is one active class.
 */
async function setCurrentClass(tx, studentId: number, classId: number | null) {
  const year = await getCurrentAcademicYear();
  const current = await tx.classStudent.findFirst({
    where: { studentId, leftAt: null, class: { academicYear: year } },
  });
  if (current?.classId === classId) return;

  if (classId) {
    const cls = await tx.class.findUnique({ where: { classId }, select: { academicYear: true } });
    if (!cls) throw httpError('Class not found', 400);
    if (cls.academicYear !== year) throw httpError(`Class is for ${cls.academicYear}, not the current year ${year}`, 400);
  }
  if (current) await tx.classStudent.update({ where: { id: current.id }, data: { leftAt: new Date() } });
  if (classId) {
    // Re-joining a class left earlier this year reopens that row (classId+studentId is unique).
    await tx.classStudent.upsert({
      where: { uq_class_student: { classId, studentId } },
      create: { classId, studentId },
      update: { leftAt: null, enrolledAt: new Date() },
    });
  }
}

/** Replaces the student's parent links; exactly one primary contact when any exist. */
async function setParents(tx, studentId: number, parents: ParentLink[]) {
  const unique = [...new Map(parents.map((p) => [p.parentUserId, p])).values()];
  const primaryIndex = Math.max(0, unique.findIndex((p) => p.isPrimaryContact));
  await tx.parentStudent.deleteMany({ where: { studentId } });
  if (unique.length === 0) return;
  try {
    await tx.parentStudent.createMany({
      data: unique.map((p, i) => ({
        studentId,
        parentUserId: p.parentUserId,
        relationship: p.relationship ?? 'guardian',
        isPrimaryContact: i === primaryIndex,
      })),
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2003') throw httpError('Every linked parent must be a Parent account', 400);
    throw err;
  }
}

export default new StudentRepository();
