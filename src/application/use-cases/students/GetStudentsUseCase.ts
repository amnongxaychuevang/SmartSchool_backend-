class GetStudentsUseCase { userAdminRepository?: any; 
  studentRepository: any;
  constructor(studentRepository) {
    this.studentRepository = studentRepository;
  }

  async execute({ search, page, limit, status, classId, gender }: any = {}) {
    return this.studentRepository.findMany({ search, page, limit, status, classId, gender });
  }
}

export default GetStudentsUseCase;
