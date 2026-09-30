import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import apiRouter from './routes';

const app = express();

// Middleware
app.use(cors({
  origin: config.corsOrigin.split(',').map((s: string) => s.trim()),
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Health
app.get('/healthz', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'medflow-backend', ts: new Date().toISOString() });
});

// API routes
app.use('/api', apiRouter);

// 404
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERR]', err);
  res.status(err.status || err.statusCode || 500).json({
    error: err.name || 'ServerError',
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`[MedFlow-Backend] listening on http://localhost:${config.port}`);
    console.log(`[MedFlow-Backend] analytics upstream: ${config.analyticsUrl}`);
    console.log(`[MedFlow-Backend] CORS origin: ${config.corsOrigin}`);
  });
}

export default app;
