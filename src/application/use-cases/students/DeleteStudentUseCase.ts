class DeleteStudentUseCase { userAdminRepository?: any; 
  studentRepository: any;
  constructor(studentRepository) {
    this.studentRepository = studentRepository;
  }

  async execute(studentId) {
    return this.studentRepository.delete(studentId);
  }
}

export default DeleteStudentUseCase;
