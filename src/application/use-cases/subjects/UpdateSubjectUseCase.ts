class UpdateSubjectUseCase { userAdminRepository?: any; 
  subjectRepository: any;
  constructor(subjectRepository) {
    this.subjectRepository = subjectRepository;
  }

  async execute(subjectId, data) {
    const {
      subjectNameEn, subjectNameLo, subjectCode,
      descriptionEn, descriptionLo,
      credits, isActive,
    } = data;

    const updateData: any = {};
    if (subjectNameEn !== undefined) updateData.subjectNameEn = subjectNameEn;
    if (subjectNameLo !== undefined) updateData.subjectNameLo = subjectNameLo;
    if (subjectCode !== undefined) updateData.subjectCode = subjectCode || null;
    if (descriptionEn !== undefined) updateData.descriptionEn = descriptionEn;
    if (descriptionLo !== undefined) updateData.descriptionLo = descriptionLo;
    if (credits !== undefined) updateData.credits = parseFloat(credits);
    if (isActive !== undefined) updateData.isActive = isActive;

    return this.subjectRepository.update(subjectId, updateData);
  }
}

export default UpdateSubjectUseCase;
