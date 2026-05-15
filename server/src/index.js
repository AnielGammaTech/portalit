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
import { securityRouter } from './routes/security.js';
import { integrationsRouter } from './routes/integrations.js';
import { customerRequestsRouter } from './routes/customerRequests.js';
import { externalRouter } from './routes/external.js';
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

// File proxy was previously mounted here as an unauthenticated route with
// Access-Control-Allow-Origin: * — moved to routes/upload.js with auth +
// SVG-attachment forcing. Audit finding H2.
// Railway and similar platforms terminate TLS before forwarding to Node. Trust
// the proxy headers so generated upload URLs use the public https origin.
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // CSP managed by frontend
  crossOriginEmbedderPolicy: false, // Allow embedded content
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Uploaded logos/icons are loaded by the frontend origin
}));

const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Requests from allowed origins are always permitted.
    if (origin && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // No-Origin requests: let the request through without ACAO. Browsers
    // omit Origin on simple GET requests (e.g., <img src=...>) by default,
    // so rejecting outright broke the customer-logo proxy. Auth-gated routes
    // still require their own tokens (requireAuth middleware) — this branch
    // does not weaken authentication, only CORS preflight behavior.
    if (!origin) {
      return callback(null, false);
    }
    return callback(null, false);
  },
  credentials: true,
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/upload/file/')) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    return next();
  }
  return corsMiddleware(req, res, next);
});
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

// Apply stricter limiter to auth-related routes FIRST (before the general limiter)
// so these paths are governed by authLimiter only — not stacked on generalLimiter.
const AUTH_RATE_LIMITED_PATHS = [
  '/api/users/send-otp',
  '/api/users/verify-otp',
  '/api/users/invite',
  '/api/users/resend-invite',
];
for (const path of AUTH_RATE_LIMITED_PATHS) {
  app.use(path, authLimiter);
}

// Apply general rate limiter to all remaining API routes (skip auth paths already limited above)
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/upload/file/')) {
    return next();
  }
  if (AUTH_RATE_LIMITED_PATHS.some(p => req.path.startsWith(p.replace('/api', '')))) {
    return next();
  }
  return generalLimiter(req, res, next);
});

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
app.use('/api/security', securityRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/customer-requests', customerRequestsRouter);
app.use('/api/external', externalRouter);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`PortalIT API running on port ${PORT}`);
  setupScheduledJobs();
});
