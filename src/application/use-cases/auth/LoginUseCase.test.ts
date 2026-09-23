import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import bcrypt from 'bcryptjs';
import LoginUseCase from './LoginUseCase';
import User from '../../../domain/entities/User';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '15m';
});

// User's constructor destructures every column with no defaults, so a partial
// test fixture needs a cast — the extra fields (phoneNumber, avatarUrl, ...)
// are irrelevant to the login flow being tested here.
function makeUser(overrides: Partial<ConstructorParameters<typeof User>[0]> = {}) {
  return new User({
    userId: 1, fullNameEn: 'Admin', fullNameLo: 'ແອັດມິນ', role: 'admin',
    email: 'admin@school.test', isActive: true,
    ...overrides,
  } as any);
}

function makeRepos() {
  return {
    userRepository: {
      findByEmail: vi.fn(),
      findByPhoneNumber: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    refreshTokenRepository: {
      issue: vi.fn().mockResolvedValue({ rawToken: 'a-raw-refresh-token', expiresAt: new Date() }),
    },
  };
}

describe('LoginUseCase', () => {
  let repos: ReturnType<typeof makeRepos>;
  let useCase: LoginUseCase;
  let passwordHash: string;

  beforeEach(async () => {
    repos = makeRepos();
    useCase = new LoginUseCase(repos.userRepository, repos.refreshTokenRepository);
    passwordHash = await bcrypt.hash('correct-password', 10);
  });

  it('returns a short-lived access token, a refresh token, and the user on valid credentials', async () => {
    const user = makeUser({ passwordHash, isActive: true });
    repos.userRepository.findByEmail.mockResolvedValue(user);

    const result = await useCase.execute('admin@school.test', 'correct-password');

    expect(result.token).toBeTruthy();
    expect(result.refreshToken).toBe('a-raw-refresh-token');
    expect(result.user.userId).toBe(1);
    expect(repos.refreshTokenRepository.issue).toHaveBeenCalledWith(1, undefined);

    // Access token must actually be short-lived — this is the whole point of
    // having a refresh token at all. Previously it was 24h.
    const [, payload] = result.token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64').toString());
    expect(claims.exp - claims.iat).toBe(15 * 60);
  });

  it('rejects an unknown identifier', async () => {
    repos.userRepository.findByEmail.mockResolvedValue(null);
    await expect(useCase.execute('nobody@school.test', 'whatever')).rejects.toThrow('Invalid credentials');
  });

  it('rejects a wrong password without revealing whether the account exists', async () => {
    const user = makeUser({ passwordHash, isActive: true });
    repos.userRepository.findByEmail.mockResolvedValue(user);

    await expect(useCase.execute('admin@school.test', 'wrong-password')).rejects.toThrow('Invalid credentials');
  });

  it('rejects a deactivated account even with the correct password', async () => {
    const user = makeUser({ passwordHash, isActive: false });
    repos.userRepository.findByEmail.mockResolvedValue(user);

    await expect(useCase.execute('admin@school.test', 'correct-password')).rejects.toThrow('Account is inactive');
  });

  it('routes phone-number identifiers to findByPhoneNumber, not findByEmail', async () => {
    repos.userRepository.findByPhoneNumber.mockResolvedValue(null);
    await expect(useCase.execute('02012345678', 'whatever')).rejects.toThrow();
    expect(repos.userRepository.findByPhoneNumber).toHaveBeenCalledWith('02012345678');
    expect(repos.userRepository.findByEmail).not.toHaveBeenCalled();
  });
});
