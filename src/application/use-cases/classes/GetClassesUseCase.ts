class GetClassesUseCase { userAdminRepository?: any; 
  classRepository: any;
  constructor(classRepository) {
    this.classRepository = classRepository;
  }

  async execute({ search, page, limit }: any = {}) {
    return this.classRepository.findMany({ search, page, limit });
  }
}

export default GetClassesUseCase;
