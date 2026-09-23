class UpdateClassUseCase { userAdminRepository?: any; 
  classRepository: any;
  constructor(classRepository) {
    this.classRepository = classRepository;
  }

  async execute(classId, data) {
    return this.classRepository.update(classId, data);
  }
}

export default UpdateClassUseCase;
