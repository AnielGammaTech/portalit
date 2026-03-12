import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { functionsRouter } from './routes/functions.js';
import { llmRouter } from './routes/llm.js';
import { usersRouter } from './routes/users.js';
import { uploadRouter } from './routes/upload.js';
import { haloRouter } from './routes/halo.js';
import { errorHandler } from './middleware/errorHandler.js';
import { setupScheduledJobs } from './scheduled.js';

const app = express();

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

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/functions', functionsRouter);
app.use('/api/llm', llmRouter);
app.use('/api/users', usersRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/halo', haloRouter);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`PortalIT API running on port ${PORT}`);
  setupScheduledJobs();
});
