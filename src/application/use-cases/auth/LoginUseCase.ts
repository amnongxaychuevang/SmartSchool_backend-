import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

class LoginUseCase { userAdminRepository?: any;
  /**
   * @param {import('../../../domain/interfaces/IUserRepository')} userRepository
   */
  userRepository: any;
  refreshTokenRepository: any;
  constructor(userRepository, refreshTokenRepository) {
    this.userRepository = userRepository;
    this.refreshTokenRepository = refreshTokenRepository;
  }

  /**
   * Execute the login use case
   * @param {string} phoneOrEmail
   * @param {string} password
   * @param {string} [userAgent]
   * @returns {Promise<{token: string, refreshToken: string, user: Object}>}
   */
  async execute(phoneOrEmail, password, userAgent?: string) {
    if (!phoneOrEmail || !password) {
      throw new Error('Phone/Email and password are required');
    }

    let user = null;
    if (phoneOrEmail.includes('@')) {
      user = await this.userRepository.findByEmail(phoneOrEmail);
    } else {
      user = await this.userRepository.findByPhoneNumber(phoneOrEmail);
    }

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActiveUser()) {
      throw new Error('Account is inactive');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      { userId: user.userId, role: user.role, langPref: user.langPref },
      process.env.JWT_SECRET,
      {
        // @types/jsonwebtoken types this as a branded string literal (e.g. "24h"), not
        // a plain `string` — env vars are always `string`, so an `any` cast is needed
        // here regardless of the actual value; behavior at runtime is unaffected.
        //
        // Short-lived on purpose: a long-lived (24h) access token was the previous
        // default, but with no way to revoke a single JWT before it expires, a
        // stolen token stayed usable for the rest of that day. The refresh token
        // below is what now carries the "stay logged in" duration, and it CAN be
        // revoked server-side (logout, or an admin forcing a re-login).
        expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any,
        algorithm: 'HS256',
      }
    );

    const { rawToken: refreshToken } = await this.refreshTokenRepository.issue(user.userId, userAgent);

    // Side-effect: update last login (fire-and-forget)
    this.userRepository.update(user.userId, { lastLogin: new Date() })
      .catch(err => console.error('Failed to update lastLogin:', err));

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

export default LoginUseCase;
