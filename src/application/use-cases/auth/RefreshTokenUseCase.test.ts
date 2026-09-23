import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import RefreshTokenUseCase from './RefreshTokenUseCase';
import User from '../../../domain/entities/User';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '15m';
});

function makeRepos() {
  return {
    userRepository: {
      findById: vi.fn(),
    },
    refreshTokenRepository: {
      findValid: vi.fn(),
      revokeByRawToken: vi.fn().mockResolvedValue(undefined),
      issue: vi.fn().mockResolvedValue({ rawToken: 'new-refresh-token', expiresAt: new Date() }),
    },
  };
}

// User's constructor destructures every column with no defaults, so a partial
// test fixture needs a cast — the extra fields are irrelevant to this flow.
function makeUser(overrides: Partial<ConstructorParameters<typeof User>[0]> = {}) {
  return new User({
    userId: 1, fullNameEn: 'Admin', fullNameLo: 'ແອັດມິນ', role: 'admin', isActive: true,
    ...overrides,
  } as any);
}

const activeUser = makeUser();

describe('RefreshTokenUseCase', () => {
  let repos: ReturnType<typeof makeRepos>;
  let useCase: RefreshTokenUseCase;

  beforeEach(() => {
    repos = makeRepos();
    useCase = new RefreshTokenUseCase(repos.userRepository, repos.refreshTokenRepository);
  });

  it('exchanges a valid refresh token for a new access token and rotates it', async () => {
    repos.refreshTokenRepository.findValid.mockResolvedValue({ userId: 1 });
    repos.userRepository.findById.mockResolvedValue(activeUser);

    const result = await useCase.execute('old-refresh-token');

    expect(result.token).toBeTruthy();
    expect(result.refreshToken).toBe('new-refresh-token');
    // Rotation: the token that was just used must be revoked, and a new one issued.
    expect(repos.refreshTokenRepository.revokeByRawToken).toHaveBeenCalledWith('old-refresh-token');
    expect(repos.refreshTokenRepository.issue).toHaveBeenCalledWith(1, undefined);
  });

  it('rejects a missing refresh token', async () => {
    await expect(useCase.execute('')).rejects.toThrow('Refresh token is required');
  });

  it('rejects an unknown, expired, or already-revoked refresh token', async () => {
    repos.refreshTokenRepository.findValid.mockResolvedValue(null);
    await expect(useCase.execute('bad-token')).rejects.toThrow('Invalid or expired refresh token');
    // Must not rotate/issue anything for a token that was never valid.
    expect(repos.refreshTokenRepository.issue).not.toHaveBeenCalled();
  });

  it('rejects reusing a refresh token that was already rotated away', async () => {
    // Simulates calling refresh twice with the same (now-revoked) token —
    // findValid must reject it the second time.
    repos.refreshTokenRepository.findValid
      .mockResolvedValueOnce({ userId: 1 })
      .mockResolvedValueOnce(null);
    repos.userRepository.findById.mockResolvedValue(activeUser);

    await useCase.execute('token-a');
    await expect(useCase.execute('token-a')).rejects.toThrow('Invalid or expired refresh token');
  });

  it('rejects a refresh token belonging to a deactivated user', async () => {
    repos.refreshTokenRepository.findValid.mockResolvedValue({ userId: 1 });
    repos.userRepository.findById.mockResolvedValue(makeUser({ isActive: false }));

    await expect(useCase.execute('old-refresh-token')).rejects.toThrow('Account is inactive');
  });
});
