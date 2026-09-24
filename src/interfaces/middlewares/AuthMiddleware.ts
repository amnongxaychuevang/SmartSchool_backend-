import jwt from 'jsonwebtoken';
import prisma from '../../infrastructure/database/PrismaClient';

const AuthMiddleware = {
  verifyToken: (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    // Accounts are deactivated rather than deleted, and an access token stays
    // valid until it expires — so check the account is still active on every request.
    prisma.user
      .findUnique({ where: { userId: Number(decoded.userId) }, select: { isActive: true } })
      .then((user) => {
        if (!user || user.isActive === false) {
          return res.status(401).json({ success: false, message: 'Account is deactivated' });
        }
        req.user = decoded; // Contains { userId, role, ... }
        next();
      })
      .catch(next);
  },

  requireRole: (roles) => {
    return (req, res, next) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions' });
      }
      next();
    };
  },

  // For unauthenticated hardware (gate scanners, POS terminals) that can't hold a user
  // login session. Requires a shared secret configured via DEVICE_API_KEY. This is an
  // interim measure — a real per-device key registry/rotation scheme should replace it.
  verifyDeviceKey: (req, res, next) => {
    const key = req.headers['x-device-key'];
    if (!process.env.DEVICE_API_KEY) {
      console.error('[AuthMiddleware] DEVICE_API_KEY is not configured — refusing all device requests.');
      return res.status(500).json({ success: false, message: 'Device authentication is not configured' });
    }
    if (!key || key !== process.env.DEVICE_API_KEY) {
      return res.status(401).json({ success: false, message: 'Invalid or missing device key' });
    }
    next();
  }
};

export default AuthMiddleware;
