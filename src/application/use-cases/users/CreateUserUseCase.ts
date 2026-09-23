import bcrypt from 'bcryptjs';

class CreateUserUseCase { userAdminRepository?: any; 
  constructor(userAdminRepository) {
    this.userAdminRepository = userAdminRepository;
  }

  async execute(data) {
    const { password, ...userData } = data;
    const passwordHash = await bcrypt.hash(password || 'password123', 10);
    return this.userAdminRepository.create({
      ...userData,
      passwordHash
    });
  }
}

export default CreateUserUseCase;
