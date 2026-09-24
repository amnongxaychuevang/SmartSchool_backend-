class GetClassesUseCase { userAdminRepository?: any; 
  classRepository: any;
  constructor(classRepository) {
    this.classRepository = classRepository;
  }

  async execute({ search, page, limit, teacherUserId }: any = {}) {
    return this.classRepository.findMany({ search, page, limit, teacherUserId });
  }
}

export default GetClassesUseCase;
