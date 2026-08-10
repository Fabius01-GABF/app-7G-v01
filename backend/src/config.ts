import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export interface Config {
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  dbPath: string;
  corsOrigins: string[];
  rateLimitAuth: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const dbPath = env.DB_PATH || './data/7gzone.db';
  const corsOrigins = (env.CORS_ORIGIN || 'http://localhost:5173,https://localhost')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    port: Number(env.PORT || 3000),
    jwtSecret: env.JWT_SECRET || 'dev-secret-change-me',
    jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
    dbPath: path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath),
    corsOrigins,
    rateLimitAuth: Number(env.RATE_LIMIT_AUTH || 10),
  };
}
