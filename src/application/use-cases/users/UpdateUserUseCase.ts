import bcrypt from 'bcryptjs';

class UpdateUserUseCase { userAdminRepository?: any; 
  constructor(userAdminRepository) {
    this.userAdminRepository = userAdminRepository;
  }

  async execute(userId, data) {
    const { password, ...userData } = data;
    const updates = { ...userData };
    if (password) {
      updates.passwordHash = await bcrypt.hash(password, 10);
    }
    return this.userAdminRepository.update(userId, updates);
  }
}

export default UpdateUserUseCase;
