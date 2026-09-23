class GetStudentsUseCase { userAdminRepository?: any; 
  studentRepository: any;
  constructor(studentRepository) {
    this.studentRepository = studentRepository;
  }

  async execute({ search, page, limit, status }: any = {}) {
    return this.studentRepository.findMany({ search, page, limit, status });
  }
}

export default GetStudentsUseCase;
