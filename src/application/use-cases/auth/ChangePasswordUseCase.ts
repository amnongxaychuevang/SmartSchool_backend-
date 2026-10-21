import bcrypt from 'bcryptjs';

const fail = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

/** A signed-in user changes their own password; the current one must be given. */
class ChangePasswordUseCase {
  userRepository: any;

  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.passwordHash) throw fail('User not found', 404);
    // 400, not 401: a 401 would make the client think the session expired.
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw fail('Current password is incorrect', 400);
    if (currentPassword === newPassword) throw fail('The new password must be different', 400);

    await this.userRepository.update(userId, { passwordHash: await bcrypt.hash(newPassword, 10) });
  }
}

export default ChangePasswordUseCase;
