class CreateClassUseCase { userAdminRepository?: any; 
  classRepository: any;
  constructor(classRepository) {
    this.classRepository = classRepository;
  }

  async execute(data) {
    return this.classRepository.create(data);
  }
}

export default CreateClassUseCase;
