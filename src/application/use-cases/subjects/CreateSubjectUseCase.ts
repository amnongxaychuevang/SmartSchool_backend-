class CreateSubjectUseCase { userAdminRepository?: any; 
  subjectRepository: any;
  constructor(subjectRepository) {
    this.subjectRepository = subjectRepository;
  }

  async execute(data) {
    const {
      subjectNameEn, subjectNameLo, subjectCode,
      descriptionEn, descriptionLo, teacherId, classId,
      credits, isActive,
    } = data;

    return this.subjectRepository.create({
      subjectNameEn,
      subjectNameLo,
      ...(subjectCode ? { subjectCode } : {}),
      ...(descriptionEn ? { descriptionEn } : {}),
      ...(descriptionLo ? { descriptionLo } : {}),
      ...(teacherId ? { teacherId: parseInt(teacherId) } : {}),
      ...(classId ? { classId: parseInt(classId) } : {}),
      ...(credits !== undefined ? { credits: parseFloat(credits) } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    });
  }
}

export default CreateSubjectUseCase;
