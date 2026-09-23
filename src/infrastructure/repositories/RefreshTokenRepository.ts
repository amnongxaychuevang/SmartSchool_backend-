import crypto from 'crypto';
import prisma from '../database/PrismaClient';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const hashToken = (rawToken: string) => crypto.createHash('sha256').update(rawToken).digest('hex');

class RefreshTokenRepository {
  /**
   * Issues a new opaque refresh token for a user. Only the SHA-256 hash is
   * persisted — the raw token is returned once and never stored, so a DB
   * leak alone can't be replayed as a working credential.
   */
  async issue(userId: number, userAgent?: string | null) {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        userAgent: userAgent ?? null,
        expiresAt,
      },
    });

    return { rawToken, expiresAt };
  }

  /**
   * Returns the token record if rawToken is a valid, unexpired, unrevoked
   * refresh token — otherwise null.
   */
  async findValid(rawToken: string) {
    if (!rawToken) return null;
    const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (!record) return null;
    if (record.revokedAt) return null;
    if (record.expiresAt < new Date()) return null;
    return record;
  }

  async revokeByRawToken(rawToken: string) {
    if (!rawToken) return;
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revokes every active refresh token for a user — e.g. on password change. */
  async revokeAllForUser(userId: number) {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export default new RefreshTokenRepository();
