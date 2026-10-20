import { describe, it, expect, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import OpenTeacherAccountUseCase from './OpenTeacherAccountUseCase';

function makeRepo({ passwordHash = null as string | null, portal = 'teacher' } = {}) {
  return {
    findTeacherUser: vi.fn().mockResolvedValue({ teacherId: 7, user: { userId: 70, passwordHash, isActive: true } }),
    findRole: vi.fn().mockResolvedValue({ roleId: 2, portal }),
    update: vi.fn().mockResolvedValue({ userId: 70 }),
  };
}

describe('OpenTeacherAccountUseCase', () => {
  it('sets a hashed password and the role on the teacher\'s user row', async () => {
    const repo = makeRepo();
    await new OpenTeacherAccountUseCase(repo).execute({ teacherId: 7, roleId: 2, password: 'secret123' });

    const [userId, data] = repo.update.mock.calls[0];
    expect(userId).toBe(70);
    expect(data.roleId).toBe(2);
    expect(await bcrypt.compare('secret123', data.passwordHash)).toBe(true);
  });

  it('refuses a teacher who already has an account', async () => {
    const repo = makeRepo({ passwordHash: 'existing-hash' });
    await expect(new OpenTeacherAccountUseCase(repo).execute({ teacherId: 7, roleId: 2, password: 'secret123' }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('refuses a role that does not open the teacher portal', async () => {
    const repo = makeRepo({ portal: 'admin' });
    await expect(new OpenTeacherAccountUseCase(repo).execute({ teacherId: 7, roleId: 1, password: 'secret123' }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown teacher', async () => {
    const repo = makeRepo();
    repo.findTeacherUser.mockResolvedValue(null);
    await expect(new OpenTeacherAccountUseCase(repo).execute({ teacherId: 999, roleId: 2, password: 'secret123' }))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
