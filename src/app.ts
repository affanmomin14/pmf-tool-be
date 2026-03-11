import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { requestLogger } from './middlewares/requestLogger.middleware';
import { errorHandler } from './middlewares/error.middleware';
import systemRoutes from './routes/system.routes';
import assessmentRoutes from './routes/assessment.routes';
import reportRoutes from './routes/report.routes';
import leadRoutes from './routes/lead.routes';

export const app = express();

// Security
app.use(helmet());
const allowedOrigins = env.CORS_ORIGINS.split(',').map((s) => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. same-origin, Postman, curl)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Allow common local dev origins even if not in env (localhost vs 127.0.0.1)
    if (origin === 'http://127.0.0.1:3000' || origin === 'http://localhost:3000') return cb(null, true);
    cb(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Request logging (BEFORE routes so every request is logged)
app.use(requestLogger);

// Health check (no auth, no validation)
app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

// Routes
app.use('/api/system', systemRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/leads', leadRoutes);

// Error handler (MUST be LAST middleware - after all routes)
app.use(errorHandler);
