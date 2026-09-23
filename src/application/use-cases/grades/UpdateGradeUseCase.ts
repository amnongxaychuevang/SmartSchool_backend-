class UpdateGradeUseCase { userAdminRepository?: any; 
  gradeRepository: any;
  constructor(gradeRepository) {
    this.gradeRepository = gradeRepository;
  }

  async execute(gradeId, data) {
    const {
      score, maxScore, gradeMonth, remarksEn, remarksLo,
      isPublished, gradeTypeId,
    } = data;

    const updateData: any = {};
    if (score !== undefined) updateData.score = parseFloat(score);
    if (maxScore !== undefined) updateData.maxScore = parseFloat(maxScore);
    if (gradeMonth !== undefined) updateData.gradeMonth = gradeMonth;
    if (remarksEn !== undefined) updateData.remarksEn = remarksEn;
    if (remarksLo !== undefined) updateData.remarksLo = remarksLo;
    if (isPublished !== undefined) updateData.isPublished = isPublished;
    if (gradeTypeId !== undefined) updateData.gradeTypeId = gradeTypeId ? parseInt(gradeTypeId) : null;

    return this.gradeRepository.update(gradeId, updateData);
  }
}

export default UpdateGradeUseCase;
