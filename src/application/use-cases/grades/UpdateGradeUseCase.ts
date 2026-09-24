class UpdateGradeUseCase { userAdminRepository?: any; 
  gradeRepository: any;
  constructor(gradeRepository) {
    this.gradeRepository = gradeRepository;
  }

  async execute(gradeId, data) {
    const {
      score, maxScore, gradeMonth, remarks,
      isPublished, gradeTypeId,
    } = data;

    const updateData: any = {};
    if (score !== undefined) updateData.score = parseFloat(score);
    if (maxScore !== undefined) updateData.maxScore = parseFloat(maxScore);
    if (gradeMonth !== undefined) updateData.gradeMonth = gradeMonth;
    if (remarks !== undefined) updateData.remarks = remarks;
    if (isPublished !== undefined) updateData.isPublished = isPublished;
    if (gradeTypeId !== undefined) updateData.gradeTypeId = gradeTypeId ? parseInt(gradeTypeId) : null;

    return this.gradeRepository.update(gradeId, updateData);
  }
}

export default UpdateGradeUseCase;
