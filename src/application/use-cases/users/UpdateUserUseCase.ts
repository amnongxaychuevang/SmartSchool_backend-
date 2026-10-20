import bcrypt from 'bcryptjs';
import { assertTeacherRole } from './OpenTeacherAccountUseCase';

class UpdateUserUseCase { userAdminRepository?: any;
  constructor(userAdminRepository) {
    this.userAdminRepository = userAdminRepository;
  }

  async execute(userId, data) {
    const { password, ...userData } = data;
    const updates = { ...userData };

    if (updates.roleId !== undefined) {
      const links = await this.userAdminRepository.findLinks(Number(userId));
      if (links?.teacher) await assertTeacherRole(this.userAdminRepository, Number(updates.roleId));
    }
    if (password) {
      updates.passwordHash = await bcrypt.hash(password, 10);
    }
    return this.userAdminRepository.update(userId, updates);
  }
}

export default UpdateUserUseCase;
