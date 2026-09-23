import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import http from 'http';
import { Server  } from 'socket.io';

import expressRouter from './infrastructure/web/ExpressRouter';
import SocketManager from './infrastructure/websocket/SocketManager';
import ErrorHandler from './interfaces/middlewares/ErrorHandler';

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

// Baseline rate limit for the whole API — tighter limits for sensitive routes
// (login, attendance scan) are applied per-route in ExpressRouter.
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Integrate API Routes
app.use('/api', expressRouter);

// Global Error Handler
app.use(ErrorHandler);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
