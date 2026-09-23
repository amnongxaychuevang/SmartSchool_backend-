class UpdateStudentUseCase { userAdminRepository?: any; 
  studentRepository: any;
  constructor(studentRepository) {
    this.studentRepository = studentRepository;
  }

  async execute(studentId, data) {
    return this.studentRepository.update(studentId, data);
  }
}

export default UpdateStudentUseCase;
