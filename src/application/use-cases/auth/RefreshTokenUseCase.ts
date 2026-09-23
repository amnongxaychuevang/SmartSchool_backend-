import jwt from 'jsonwebtoken';

class RefreshTokenUseCase { userRepository: any; refreshTokenRepository: any;
  constructor(userRepository, refreshTokenRepository) {
    this.userRepository = userRepository;
    this.refreshTokenRepository = refreshTokenRepository;
  }

  /**
   * Exchanges a still-valid refresh token for a new access token, rotating
   * the refresh token in the same step (the old one is revoked immediately —
   * it can't be used again even if it leaks after this call).
   */
  async execute(rawRefreshToken: string, userAgent?: string) {
    if (!rawRefreshToken) {
      throw new Error('Refresh token is required');
    }

    const record = await this.refreshTokenRepository.findValid(rawRefreshToken);
    if (!record) {
      throw new Error('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findById(record.userId);
    if (!user || !user.isActiveUser()) {
      throw new Error('Account is inactive');
    }

    // Rotate: revoke the token that was just used and issue a fresh one.
    // If a leaked/stolen refresh token is replayed after the legitimate
    // client already rotated it, this lookup will simply fail on the next
    // attempt (findValid won't match a revoked hash).
    await this.refreshTokenRepository.revokeByRawToken(rawRefreshToken);
    const { rawToken: refreshToken } = await this.refreshTokenRepository.issue(user.userId, userAgent);

    const token = jwt.sign(
      { userId: user.userId, role: user.role, langPref: user.langPref },
      process.env.JWT_SECRET,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any, algorithm: 'HS256' }
    );

    return {
      token,
      refreshToken,
      user: {
        userId: user.userId,
        fullNameEn: user.fullNameEn,
        fullNameLo: user.fullNameLo,
        role: user.role,
        langPref: user.langPref,
        avatarUrl: user.avatarUrl,
      },
    };
  }
}

export default RefreshTokenUseCase;
