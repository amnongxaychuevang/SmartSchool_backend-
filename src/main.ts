import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import http from 'http';
import { Server  } from 'socket.io';

import expressRouter from './infrastructure/web/ExpressRouter';
import SocketManager from './infrastructure/websocket/SocketManager';
import ErrorHandler from './interfaces/middlewares/ErrorHandler';
import { UPLOAD_ROOT, UPLOAD_URL_PREFIX } from './infrastructure/storage/PhotoStorage';
import { startAutoAbsenceJob } from './infrastructure/jobs/AutoAbsenceJob';
import { startFeeReminderJob } from './infrastructure/jobs/FeeReminderJob';

const app = express();
const server = http.createServer(app);

// Initialize SocketManager
const socketManager = new SocketManager(server);
app.set('socketManager', socketManager);

// Security headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet());

// Restrict cross-origin access to the configured frontend origin(s) in production.
// CORS_ORIGIN accepts a comma-separated list; falls back to "allow all" only in dev.
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : process.env.NODE_ENV === 'production'
    ? [] // production with no CORS_ORIGIN configured = no cross-origin access, fail safe
    : true; // dev default: allow all origins
app.use(cors({ origin: corsOrigins }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Behind a reverse proxy (nginx, Cloudflare…) set TRUST_PROXY (e.g. "1") so req.ip is
// the client's address rather than the proxy's.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
}

// The signed-in user behind a request, if its token is valid (checked once per request).
const tokenUserId = (req: any): number | null => {
  if (req._rateLimitUser !== undefined) return req._rateLimitUser;
  const header = req.headers.authorization;
  let userId: number | null = null;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    try {
      userId = (jwt.verify(header.slice(7), process.env.JWT_SECRET as string) as { userId?: number }).userId ?? null;
    } catch { /* expired or invalid: treated as anonymous */ }
  }
  req._rateLimitUser = userId;
  return userId;
};

// Baseline rate limit for the whole API. Signed-in users are counted per account, so a
// whole school sharing one internet address is never throttled together; anonymous
// requests are counted per IP. Tighter limits for sensitive routes (login, scans,
// password reset) are applied per-route in ExpressRouter.
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: (req) => (tokenUserId(req) ? 1500 : 300),
  keyGenerator: (req) => {
    const userId = tokenUserId(req);
    return userId ? `user:${userId}` : `ip:${ipKeyGenerator(req.ip ?? '')}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down and try again shortly' },
}));

// Uploaded photos. Names are random UUIDs, so a URL can't be guessed; helmet's
// default same-origin resource policy would stop the frontend (another port/domain)
// from displaying them, so these files alone are allowed cross-origin.
app.use(UPLOAD_URL_PREFIX, (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(UPLOAD_ROOT, { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny' }));

// Integrate API Routes
app.use('/api', expressRouter);

// Global Error Handler
app.use(ErrorHandler);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

startAutoAbsenceJob();
startFeeReminderJob();
