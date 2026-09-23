class CreateGradeUseCase { userAdminRepository?: any; 
  gradeRepository: any;
  constructor(gradeRepository) {
    this.gradeRepository = gradeRepository;
  }

  async execute(data, userId) {
    const {
      studentId, subjectId, teacherId, gradeTypeId,
      score, maxScore, gradeMonth, remarksEn, remarksLo, isPublished,
    } = data;

    return this.gradeRepository.create({
      studentId: parseInt(studentId),
      subjectId: parseInt(subjectId),
      teacherId: parseInt(teacherId || userId),
      ...(gradeTypeId ? { gradeTypeId: parseInt(gradeTypeId) } : {}),
      ...(score !== undefined ? { score: parseFloat(score) } : {}),
      ...(maxScore !== undefined ? { maxScore: parseFloat(maxScore) } : {}),
      ...(gradeMonth ? { gradeMonth } : {}),
      ...(remarksEn ? { remarksEn } : {}),
      ...(remarksLo ? { remarksLo } : {}),
      ...(isPublished !== undefined ? { isPublished } : {}),
    });
  }
}

export default CreateGradeUseCase;
