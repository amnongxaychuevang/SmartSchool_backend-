import bcrypt from 'bcryptjs';

const httpError = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

/**
 * Opens a login account for an existing teacher record: sets the password and
 * role on the teacher's user row. The teacher's phone/email is the login name.
 */
class OpenTeacherAccountUseCase {
  userAdminRepository: any;

  constructor(userAdminRepository) {
    this.userAdminRepository = userAdminRepository;
  }

  async execute({ teacherId, roleId, password }: { teacherId: number; roleId: number; password: string }) {
    const teacher = await this.userAdminRepository.findTeacherUser(teacherId);
    if (!teacher) throw httpError('Teacher not found', 404);
    if (teacher.user.passwordHash) throw httpError('This teacher already has a login account', 409);

    await assertTeacherRole(this.userAdminRepository, roleId);

    const passwordHash = await bcrypt.hash(password, 10);
    return this.userAdminRepository.update(teacher.user.userId, { passwordHash, roleId });
  }
}

/** A teacher's account must open the teacher portal, or their classes and grades pages vanish. */
export async function assertTeacherRole(userAdminRepository, roleId: number) {
  const role = await userAdminRepository.findRole(roleId);
  if (!role) throw httpError('Role not found', 400);
  if (role.portal !== 'teacher') throw httpError('A teacher account needs a teacher role', 400);
}

export default OpenTeacherAccountUseCase;
