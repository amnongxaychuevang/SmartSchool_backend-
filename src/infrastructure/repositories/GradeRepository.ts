import prisma from '../database/PrismaClient';

// A grade belongs to a ClassSubject (class + subject + term). Responses still carry
// a top-level `subject` (and now `class` / `term`) so existing screens keep working.
const include = {
  student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } },
  classSubject: {
    select: {
      id: true,
      class: { select: { classId: true, classNameEn: true, classNameLo: true } },
      subject: { select: { subjectId: true, subjectNameEn: true, subjectNameLo: true } },
      term: { select: { termId: true, termNameEn: true, termNameLo: true, academicYear: true } },
    },
  },
  teacher: { select: { userId: true, fullNameEn: true, fullNameLo: true } },
  gradeType: { select: { typeId: true, typeNameEn: true, typeNameLo: true } },
};

export function flattenGrade(grade) {
  if (!grade) return grade;
  const { classSubject, ...rest } = grade;
  return {
    ...rest,
    subjectId: classSubject.subject.subjectId,
    classId: classSubject.class.classId,
    subject: classSubject.subject,
    class: classSubject.class,
    term: classSubject.term,
  };
}

class GradeRepository {
  async findMany({ studentId, subjectId, classId, termId, gradeMonth, page = 1, limit = 30 }: any = {}) {
    const skip = (page - 1) * limit;
    const where = {
      ...(studentId ? { studentId: parseInt(studentId) } : {}),
      ...(gradeMonth ? { gradeMonth } : {}),
      classSubject: {
        ...(subjectId ? { subjectId: parseInt(subjectId) } : {}),
        ...(classId ? { classId: parseInt(classId) } : {}),
        ...(termId ? { termId: parseInt(termId) } : {}),
      },
    };

    const [grades, total] = await Promise.all([
      prisma.grade.findMany({ where, skip, take: limit, orderBy: { recordedAt: 'desc' }, include }),
      prisma.grade.count({ where }),
    ]);

    return { grades: grades.map(flattenGrade), total, page, limit };
  }

  async findById(gradeId) {
    return flattenGrade(await prisma.grade.findUnique({ where: { gradeId: parseInt(gradeId) }, include }));
  }

  async findGradeTypes() {
    return prisma.gradeType.findMany({ orderBy: { typeNameEn: 'asc' } });
  }

  async create(data) {
    return flattenGrade(await prisma.grade.create({ data, include }));
  }

  async update(gradeId, data) {
    return flattenGrade(await prisma.grade.update({ where: { gradeId: parseInt(gradeId) }, data, include }));
  }

  async delete(gradeId) {
    return prisma.grade.delete({ where: { gradeId: parseInt(gradeId) } });
  }
}

export default new GradeRepository();
