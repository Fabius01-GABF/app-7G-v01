import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server as IoServer, type Socket as IoServerSocket } from 'socket.io';
import { io as ioClient, type Socket as IoClientSocket } from 'socket.io-client';
import { openDb, type DbHandle } from './db';
import { Repo } from './repo';
import { seedDefaults } from './seed';
import { loadConfig } from './config';
import { attachSocket } from './socket';
import { registerUser } from './services';

let handle: DbHandle;
let repo: Repo;
let cfg: ReturnType<typeof loadConfig>;
let httpServer: HttpServer;
let ioServer: IoServer;
let url: string;
const clients: IoClientSocket[] = [];

function once<T = unknown>(sock: IoClientSocket, name: string): Promise<T> {
  return new Promise((resolve) => sock.once(name, (data) => resolve(data as T)));
}

function connect(token: string): Promise<IoClientSocket> {
  const sock = ioClient(url, { auth: { token }, transports: ['websocket'], reconnection: false, timeout: 5000 });
  clients.push(sock);
  return new Promise((resolve, reject) => {
    sock.on('connect', () => resolve(sock));
    sock.on('connect_error', (err) => reject(err));
  });
}

function register(username: string, email: string) {
  const res = registerUser(repo, cfg, {
    username,
    email,
    password: 'password-123',
    security_question: 'Animal préféré ?',
    security_answer: 'chien',
  });
  return res as { token: string; user: { id: number; username: string } };
}

before(async () => {
  cfg = loadConfig({ JWT_SECRET: 'socket-secret', RATE_LIMIT_AUTH: '1000' });
  handle = openDb(':memory:');
  repo = new Repo(handle.db);
  seedDefaults(repo);
  httpServer = createServer((_req, res) => {
    res.writeHead(404);
    res.end();
  });
  ioServer = new IoServer(httpServer, { cors: { origin: cfg.corsOrigins } });
  attachSocket(ioServer, cfg, repo);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
});

after(async () => {
  for (const c of clients) c.disconnect();
  ioServer.disconnectSockets(true);
  await new Promise<void>((resolve) => ioServer.close(() => resolve()));
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  handle.close();
});

describe('socket auth', () => {
  it('rejects a socket without a valid token', async () => {
    const bad = ioClient(url, { auth: { token: 'nope' }, transports: ['websocket'], reconnection: false });
    clients.push(bad);
    const err = await once<{ message: string }>(bad, 'connect_error');
    assert.equal(err.message, 'unauthorized');
  });
});

describe('socket chess room', () => {
  it('creates a room, joins, starts, syncs a legal move and rejects an illegal one', async () => {
    const a = register('rook', 'rook@test.dev');
    const b = register('pawn', 'pawn@test.dev');
    const A = await connect(a.token);
    const B = await connect(b.token);

    const pCreated = once<{ code: string; room: { status: string; players: unknown[] } }>(A, 'room:created');
    A.emit('room:create', { game: 'chess', mode: 'private' });
    const created = await pCreated;
    assert.ok(created.code.length === 6);
    assert.equal(created.room.status, 'lobby');

    const pJoined = once<{ code: string; room: { players: unknown[] } }>(B, 'room:joined');
    const pJoinErr = once<{ message: string }>(B, 'room:error');
    const pJoinUpd = once<{ room: { status: string } }>(B, 'room:update');
    B.emit('room:join', { code: created.code });
    const joined = (await Promise.race([
      pJoined.then((v) => ({ kind: 'joined', v })),
      pJoinErr.then((v) => ({ kind: 'error', v })),
      pJoinUpd.then((v) => ({ kind: 'update', v })),
      new Promise((resolve) => setTimeout(() => resolve({ kind: 'timeout', v: null }), 4000)),
    ])) as { kind: 'joined' | 'error' | 'update' | 'timeout'; v: { code?: string; room?: { status: string; players: unknown[] } } | null };
    if (joined.kind !== 'joined') assert.fail(`no room:joined, got ${joined.kind}`);
    assert.equal(joined.v!.room!.players.length, 2);

    const pStartA = once<{ state: { board: string[]; turn: string; playerIds: string[] }; yourSlot: number | null }>(A, 'game:state');
    const pStartB = once<{ state: { board: string[]; turn: string; playerIds: string[] }; yourSlot: number | null }>(B, 'game:state');
    A.emit('game:start');
    const [started] = await Promise.all([pStartA, pStartB]);
    assert.equal(started.state.board.length, 64);
    assert.equal(started.state.turn, 'w');
    assert.deepEqual(started.state.playerIds, [String(a.user.id), String(b.user.id)]);
    assert.equal(started.yourSlot, 0);

    const pMoveA = once<{ state: { board: string[] } }>(A, 'game:state');
    const pMoveB = once<{ state: { board: string[] } }>(B, 'game:state');
    A.emit('game:action', { action: { from: 52, to: 36 } });
    const afterA = await pMoveA;
    const afterB = await pMoveB;
    assert.equal(afterA.state.board[36], 'P');
    assert.equal(afterA.state.board[52], '');
    assert.equal(afterB.state.board[36], 'P');

    const pErr = once<{ message: string }>(A, 'game:error');
    A.emit('game:action', { action: { from: 0, to: 63 } });
    const err = await pErr;
    assert.match(err.message, /not_your_turn|refus|illegal/i);
  });

  it('handles disconnection and reconnection with state recovery', async () => {
    const a = register('knight', 'knight@test.dev');
    const b = register('bishop', 'bishop@test.dev');
    const A = await connect(a.token);
    const B = await connect(b.token);

    const pCreated = once<{ code: string }>(A, 'room:created');
    A.emit('room:create', { game: 'chess', mode: 'private' });
    const { code } = await pCreated;

    const pJoined = once(B, 'room:joined');
    B.emit('room:join', { code });
    await pJoined;

    const pStart = once<{ state: { board: string[] } }>(A, 'game:state');
    A.emit('game:start');
    await pStart;

    const pPresence = once<{ userId: number; connected: boolean }>(A, 'room:presence');
    B.disconnect();
    const presence = await pPresence;
    assert.equal(presence.userId, b.user.id);
    assert.equal(presence.connected, false);

    const B2 = await connect(b.token);
    const pReconnect = once<{ code: string; state: { board: string[] } }>(B2, 'game:state');
    B2.emit('room:reconnect', { code });
    const recovered = await pReconnect;
    assert.equal(recovered.code, code);
    assert.equal(recovered.state.board.length, 64);
  });

  it('records a win when a player resigns', async () => {
    const a = register('queen', 'queen@test.dev');
    const b = register('king', 'king@test.dev');
    const A = await connect(a.token);
    const B = await connect(b.token);

    const pCreated = once<{ code: string }>(A, 'room:created');
    A.emit('room:create', { game: 'chess', mode: 'private' });
    const { code } = await pCreated;

    const pJoined = once(B, 'room:joined');
    B.emit('room:join', { code });
    await pJoined;

    const pStart = once(A, 'game:state');
    A.emit('game:start');
    await pStart;

    const pFinished = once<{ winner: string | null; reason: string }>(B, 'game:finished');
    B.emit('game:resign');
    const finished = await pFinished;
    assert.equal(finished.winner, String(a.user.id));
    assert.equal(finished.reason, 'resigned');

    const profB = repo.getProfile(b.user.id)!;
    assert.equal(Number(profB.losses), 1);
  });
});

describe('socket matchmaking', () => {
  it('pairs two queued players into the same playing room', async () => {
    const c = register('torre', 'torre@test.dev');
    const d = register('alfil', 'alfil@test.dev');
    const C = await connect(c.token);
    const D = await connect(d.token);

    const pC = once<{ code: string }>(C, 'mm:found');
    const pD = once<{ code: string }>(D, 'mm:found');
    const pStateC = once<{ state: { board: string[] }; yourSlot: number | null }>(C, 'game:state');
    const pStateD = once<{ state: { board: string[] }; yourSlot: number | null }>(D, 'game:state');
    C.emit('mm:join', { game: 'chess', mode: 'casual' });
    D.emit('mm:join', { game: 'chess', mode: 'casual' });
    const [foundC, foundD, stC, stD] = await Promise.all([pC, pD, pStateC, pStateD]);
    assert.equal(foundC.code, foundD.code);
    assert.equal(stC.state.board.length, 64);
    assert.equal(stD.state.board.length, 64);
  });
});
