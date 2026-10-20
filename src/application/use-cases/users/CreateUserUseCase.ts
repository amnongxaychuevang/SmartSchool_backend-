import bcrypt from 'bcryptjs';

class CreateUserUseCase { userAdminRepository?: any;
  constructor(userAdminRepository) {
    this.userAdminRepository = userAdminRepository;
  }

  async execute(data) {
    const { password, ...userData } = data;
    // The validator requires a password; there is no shared default to fall back on.
    const passwordHash = await bcrypt.hash(password, 10);
    return this.userAdminRepository.create({
      ...userData,
      passwordHash
    });
  }
}

export default CreateUserUseCase;
