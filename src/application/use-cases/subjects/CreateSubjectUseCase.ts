class CreateSubjectUseCase { userAdminRepository?: any; 
  subjectRepository: any;
  constructor(subjectRepository) {
    this.subjectRepository = subjectRepository;
  }

  async execute(data) {
    const {
      subjectNameEn, subjectNameLo, subjectCode,
      descriptionEn, descriptionLo,
      credits, isActive,
    } = data;

    const generatedCode = subjectCode || `SUB-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    return this.subjectRepository.create({
      subjectNameEn,
      subjectNameLo,
      subjectCode: generatedCode,
      ...(descriptionEn ? { descriptionEn } : {}),
      ...(descriptionLo ? { descriptionLo } : {}),
      ...(credits !== undefined ? { credits: parseFloat(credits) } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    });
  }
}

export default CreateSubjectUseCase;
