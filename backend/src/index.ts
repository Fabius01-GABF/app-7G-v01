import http from 'node:http';
import { Server } from 'socket.io';
import { loadConfig } from './config';
import { openDb } from './db';
import { Repo } from './repo';
import { createApp } from './app';
import { attachSocket } from './socket';
import { seedDefaults } from './seed';

const cfg = loadConfig();
const { db } = openDb(cfg.dbPath);
const repo = new Repo(db);
seedDefaults(repo);

const app = createApp(cfg, repo);

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: cfg.corsOrigins, credentials: true },
});
attachSocket(io, cfg, repo);

httpServer.listen(cfg.port, () => {
  console.log(`[7gzone] API + Socket.IO on :${cfg.port} (db: ${cfg.dbPath})`);
});
