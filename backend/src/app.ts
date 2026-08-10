import express from 'express';
import cors from 'cors';
import type { Config } from './config';
import type { Repo } from './repo';
import { buildApiRouter } from './routes';

export function createApp(cfg: Config, repo: Repo) {
  const app = express();
  app.use(cors({ origin: cfg.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '256kb' }));
  app.use('/api', buildApiRouter(cfg, repo));
  return app;
}
