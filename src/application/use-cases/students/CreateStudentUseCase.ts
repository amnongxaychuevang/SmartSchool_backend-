class CreateStudentUseCase { userAdminRepository?: any; 
  studentRepository: any;
  constructor(studentRepository) {
    this.studentRepository = studentRepository;
  }

  async execute(data) {
    return this.studentRepository.create(data);
  }
}

export default CreateStudentUseCase;
