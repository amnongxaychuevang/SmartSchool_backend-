class GetUsersUseCase { userAdminRepository?: any; 
  constructor(userAdminRepository) {
    this.userAdminRepository = userAdminRepository;
  }

  async execute({ role, search, page, limit }: any = {}) {
    return this.userAdminRepository.findMany({ role, search, page, limit });
  }
}

export default GetUsersUseCase;
