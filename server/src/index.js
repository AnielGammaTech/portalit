import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createRateLimiter } from './middleware/rate-limit.js';
import { functionsRouter } from './routes/functions.js';
import { llmRouter } from './routes/llm.js';
import { usersRouter } from './routes/users.js';
import { uploadRouter } from './routes/upload.js';
import { haloRouter } from './routes/halo.js';
import { cronRouter } from './routes/cron.js';
import { errorHandler } from './middleware/errorHandler.js';
import { setupScheduledJobs } from './scheduled.js';

// ── Validate required environment variables at startup ───────────────

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY'];
const OPTIONAL_ENV = ['FRONTEND_URL', 'CORS_ORIGIN', 'EMAIL_FROM', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

for (const key of OPTIONAL_ENV) {
  if (!process.env[key]) {
    console.warn(`WARN: Optional environment variable not set: ${key}`);
  }
}

// ── App setup ────────────────────────────────────────────────────────

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // CSP managed by frontend
  crossOriginEmbedderPolicy: false, // Allow embedded content
}));

const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, health checks)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ── Rate limiters ────────────────────────────────────────────────────

const generalLimiter = createRateLimiter({
  storeId: 'general',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: 'Too many requests. Please try again later.',
});

const authLimiter = createRateLimiter({
  storeId: 'auth',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: 'Too many authentication requests. Please try again later.',
});

// Apply general rate limiter to all API routes
app.use('/api', generalLimiter);

// Apply stricter limiter to auth-related routes
app.use('/api/users/send-otp', authLimiter);
app.use('/api/users/verify-otp', authLimiter);
app.use('/api/users/invite', authLimiter);
app.use('/api/users/resend-invite', authLimiter);

// Health check (outside rate limiter)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/functions', functionsRouter);
app.use('/api/llm', llmRouter);
app.use('/api/users', usersRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/halo', haloRouter);
app.use('/api/cron', cronRouter);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`PortalIT API running on port ${PORT}`);
  setupScheduledJobs();
});
