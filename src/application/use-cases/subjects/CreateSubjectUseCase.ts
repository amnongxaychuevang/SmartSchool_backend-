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

    return this.subjectRepository.create({
      subjectNameEn,
      subjectNameLo,
      ...(subjectCode ? { subjectCode } : {}),
      ...(descriptionEn ? { descriptionEn } : {}),
      ...(descriptionLo ? { descriptionLo } : {}),
      ...(credits !== undefined ? { credits: parseFloat(credits) } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    });
  }
}

export default CreateSubjectUseCase;
