import classSubjectRepository from '../../../infrastructure/repositories/ClassSubjectRepository';

class CreateGradeUseCase { userAdminRepository?: any;
  gradeRepository: any;

  constructor(gradeRepository) {
    this.gradeRepository = gradeRepository;
  }

  /**
   * `user` is the logged-in user. A teacher may only grade the class subjects they
   * teach, and is always recorded as the grading teacher.
   */
  async execute(data, user) {
    const {
      studentId, classSubjectId, classId, subjectId, termId, teacherId, gradeTypeId,
      score, maxScore, gradeMonth, remarks, isPublished,
    } = data;

    const classSubject = classSubjectId
      ? await classSubjectRepository.findById(parseInt(classSubjectId))
      : await classSubjectRepository.resolve(parseInt(classId), parseInt(subjectId), termId ? parseInt(termId) : undefined);
    if (!classSubject) {
      throw Object.assign(new Error('Class subject not found'), { statusCode: 404 });
    }
    if (user?.role === 'teacher' && classSubject.teacherId !== user.userId) {
      throw Object.assign(new Error('You do not teach this subject to this class'), { statusCode: 403 });
    }

    // The grading teacher must be a Teacher (DB constraint): the logged-in teacher, or for
    // admins an explicit teacherId / the class subject's assigned teacher.
    const gradingTeacherId = user?.role === 'teacher' ? user.userId : (teacherId ?? classSubject.teacherId);
    if (!gradingTeacherId) {
      throw Object.assign(new Error('Assign a teacher to this class subject first, or pass teacherId'), { statusCode: 400 });
    }

    return this.gradeRepository.create({
      studentId: parseInt(studentId),
      classSubjectId: classSubject.id,
      teacherId: parseInt(gradingTeacherId),
      ...(gradeTypeId ? { gradeTypeId: parseInt(gradeTypeId) } : {}),
      ...(score !== undefined ? { score: parseFloat(score) } : {}),
      ...(maxScore !== undefined ? { maxScore: parseFloat(maxScore) } : {}),
      ...(gradeMonth ? { gradeMonth } : {}),
      ...(remarks ? { remarks } : {}),
      ...(isPublished !== undefined ? { isPublished } : {}),
    });
  }
}

export default CreateGradeUseCase;
