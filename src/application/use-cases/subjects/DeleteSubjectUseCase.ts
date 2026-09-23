class DeleteSubjectUseCase { userAdminRepository?: any; 
  subjectRepository: any;
  constructor(subjectRepository) {
    this.subjectRepository = subjectRepository;
  }

  async execute(subjectId) {
    return this.subjectRepository.delete(subjectId);
  }
}

export default DeleteSubjectUseCase;
