import LoginUseCase from '../../application/use-cases/auth/LoginUseCase';
import GetMeUseCase from '../../application/use-cases/auth/GetMeUseCase';
import RefreshTokenUseCase from '../../application/use-cases/auth/RefreshTokenUseCase';
import UserRepository from '../../infrastructure/repositories/UserRepository';
import refreshTokenRepository from '../../infrastructure/repositories/RefreshTokenRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';
import roleRepository from '../../infrastructure/repositories/RoleRepository';

// The client needs to know which portal the user belongs to and what they may do
// there (to route them and to show only the menus they can use). The server still
// checks every request; this is for the UI only.
async function withAccess<T extends { role: string }>(user: T) {
  const access = await roleRepository.accessFor(user.role);
  return {
    ...user,
    portal: access?.portal ?? null,
    permissions: access?.permissions ?? [],
    roleNameEn: access?.roleNameEn ?? user.role,
    roleNameLo: access?.roleNameLo ?? user.role,
  };
}

// Dependency wiring — only happens here, controllers are thin
const userRepository = new UserRepository();
const loginUseCase = new LoginUseCase(userRepository, refreshTokenRepository);
const getMeUseCase = new GetMeUseCase(userRepository);
const refreshTokenUseCase = new RefreshTokenUseCase(userRepository, refreshTokenRepository);

class AuthController {
  async login(req, res, next) {
    const { phoneOrEmail, password } = req.body;
    try {
      const result = await loginUseCase.execute(phoneOrEmail, password, req.headers['user-agent']);

      auditLogRepository.log({
        userId: result.user.userId,
        action: 'login',
        entityType: 'user',
        entityId: result.user.userId,
        ipAddress: req.ip,
      });

      res.json({ success: true, data: { ...result, user: await withAccess(result.user) } });
    } catch (error) {
      if (error.message === 'Invalid credentials' || error.message === 'Account is inactive') {
        auditLogRepository.log({
          userId: null,
          action: 'login_failed',
          entityType: 'user',
          detail: { attemptedIdentifier: phoneOrEmail, reason: error.message },
          ipAddress: req.ip,
        });
        return res.status(401).json({ success: false, message: error.message });
      }
      if (error.message === 'Phone/Email and password are required') {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async me(req, res, next) {
    try {
      // req.user is set by AuthMiddleware.verifyToken
      const user = await getMeUseCase.execute(req.user.userId);
      res.json({ success: true, data: { user: await withAccess(user) } });
    } catch (error) {
      // GetMeUseCase throws 'User not found' — surface as 404
      if (error.message === 'User not found') {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  /**
   * Exchanges a refresh token (issued at login) for a new short-lived access
   * token. No user JWT is required here — the refresh token itself is the
   * credential, which is why it's validated against its DB-stored hash.
   */
  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await refreshTokenUseCase.execute(refreshToken, req.headers['user-agent']);
      res.json({ success: true, data: { ...result, user: await withAccess(result.user) } });
    } catch (error) {
      if (error.message === 'Invalid or expired refresh token' || error.message === 'Account is inactive') {
        return res.status(401).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const { refreshToken } = req.body || {};
      if (refreshToken) {
        await refreshTokenRepository.revokeByRawToken(refreshToken);
      }
      if (req.user) {
        auditLogRepository.log({
          userId: req.user.userId,
          action: 'logout',
          entityType: 'user',
          entityId: req.user.userId,
          ipAddress: req.ip,
        });
      }
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
