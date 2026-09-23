class DeleteClassUseCase { userAdminRepository?: any; 
  classRepository: any;
  constructor(classRepository) {
    this.classRepository = classRepository;
  }

  async execute(classId) {
    return this.classRepository.delete(classId);
  }
}

export default DeleteClassUseCase;
