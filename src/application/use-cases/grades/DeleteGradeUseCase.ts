class DeleteGradeUseCase { userAdminRepository?: any; 
  gradeRepository: any;
  constructor(gradeRepository) {
    this.gradeRepository = gradeRepository;
  }

  async execute(gradeId) {
    return this.gradeRepository.delete(gradeId);
  }
}

export default DeleteGradeUseCase;
