import express from 'express';
import helmet from 'helmet';
import { healthRouter } from './routes/health.ts';
import { requestIdMiddleware } from './middleware/request-id.ts';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);
  app.use('/health', healthRouter);
  return app;
}
