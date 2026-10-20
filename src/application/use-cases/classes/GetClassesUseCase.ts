class GetClassesUseCase { userAdminRepository?: any; 
  classRepository: any;
  constructor(classRepository) {
    this.classRepository = classRepository;
  }

  async execute({ search, page, limit, teacherUserId, academicYear, status }: any = {}) {
    return this.classRepository.findMany({ search, page, limit, teacherUserId, academicYear, status });
  }
}

export default GetClassesUseCase;
