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

// ── Public file proxy — mounted BEFORE helmet/CORS so <img> tags work cross-origin ──
import { getServiceSupabase } from './lib/supabase.js';
app.get('/api/upload/file/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    if (!fileName) return res.status(400).json({ error: 'File name required' });
    const safeFile = fileName.replace(/[\/\\]/g, '').replace(/\.\./g, '').slice(0, 300);
    if (!safeFile) return res.status(400).json({ error: 'Invalid file name' });

    const supabase = getServiceSupabase();
    const { data, error } = await supabase.storage.from('uploads').download(safeFile);
    if (error || !data) return res.status(404).json({ error: 'File not found' });

    const ext = safeFile.split('.').pop().toLowerCase();
    const mimeTypes = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      webp: 'image/webp', ico: 'image/x-icon', svg: 'image/svg+xml',
      gif: 'image/gif', pdf: 'application/pdf',
    };
    res.set('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Access-Control-Allow-Origin', '*');
    res.send(Buffer.from(await data.arrayBuffer()));
  } catch (_err) {
    res.status(500).json({ error: 'Failed to load file' });
  }
});

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
    // Requests from allowed origins are always permitted.
    if (origin && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Requests with no Origin header must not be allowed through CORS for
    // browser-facing APIs. Reject them so that the browser blocks the response.
    // (Server-to-server callers that legitimately omit Origin must authenticate
    // via a service-role token and are verified independently at the route level.)
    if (!origin) {
      return callback(new Error('CORS: requests without an Origin header are not permitted'), false);
    }
    return callback(null, false);
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

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`PortalIT API running on port ${PORT}`);
  setupScheduledJobs();

  // One-time JumpCloud user backfill — populates cached_data.users for exclusion picker
  // Safe to remove after 2026-04-22
  try {
    const { syncJumpCloudLicenses } = await import('./functions/syncJumpCloudLicenses.js');
    console.log('[startup] Backfilling JumpCloud user cache...');
    syncJumpCloudLicenses({ action: 'sync_all' }, null)
      .then(r => console.log('[startup] JumpCloud backfill done:', r?.synced || 0, 'orgs'))
      .catch(e => console.error('[startup] JumpCloud backfill failed:', e.message));
  } catch (e) {
    console.error('[startup] JumpCloud backfill error:', e.message);
  }
});
