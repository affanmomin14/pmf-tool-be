import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { requestLogger } from './middlewares/requestLogger.middleware';
import { errorHandler } from './middlewares/error.middleware';
import systemRoutes from './routes/system.routes';

export const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGINS.split(',').map((s) => s.trim()),
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

// Error handler (MUST be LAST middleware - after all routes)
app.use(errorHandler);
