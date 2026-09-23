class DeleteUserUseCase { userAdminRepository?: any; 
  constructor(userAdminRepository) {
    this.userAdminRepository = userAdminRepository;
  }

  async execute(userId) {
    return this.userAdminRepository.delete(userId);
  }
}

export default DeleteUserUseCase;
