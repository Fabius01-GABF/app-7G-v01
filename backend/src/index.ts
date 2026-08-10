import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server } from 'socket.io';
import { loadConfig } from './config';
import { openDb } from './db';
import { Repo } from './repo';
import { buildApiRouter } from './routes';
import { attachSocket } from './socket';
import { seedDefaults } from './seed';

const cfg = loadConfig();
const { db } = openDb(cfg.dbPath);
const repo = new Repo(db);
seedDefaults(repo);

const app = express();
app.use(cors({ origin: cfg.corsOrigins, credentials: true }));
app.use(express.json({ limit: '256kb' }));
app.use('/api', buildApiRouter(cfg, repo));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: cfg.corsOrigins, credentials: true },
});
attachSocket(io, cfg, repo);

httpServer.listen(cfg.port, () => {
  console.log(`[7gzone] API + Socket.IO on :${cfg.port} (db: ${cfg.dbPath})`);
});
