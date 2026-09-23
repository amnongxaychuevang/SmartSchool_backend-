class DeleteParentUseCase { userAdminRepository?: any; 
  parentRepository: any;
  constructor(parentRepository) {
    this.parentRepository = parentRepository;
  }

  async execute(parentId) {
    return this.parentRepository.delete(parentId);
  }
}

export default DeleteParentUseCase;
