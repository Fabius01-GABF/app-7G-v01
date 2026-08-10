import { Server, type Socket } from 'socket.io';
import { adapters, advanceQuiz, type GameKind, type AiDifficulty, type QuizState } from '../../shared/src/index';
import { mulberry32 } from '../../shared/src/core/rng';
import type { GameEvent } from '../../shared/src/core/types';
import type { Config } from './config';
import type { Repo } from './repo';
import { verifyToken } from './security';
import * as svc from './services';

interface RoomPlayer {
  userId: number;
  connected: boolean;
}

interface GameRoom {
  code: string;
  game: GameKind;
  mode: 'casual' | 'ranked' | 'private';
  hostId: number;
  status: 'lobby' | 'playing' | 'finished' | 'abandoned';
  players: RoomPlayer[];
  state: unknown;
  seed: number;
  rng: () => number;
  matchId: number | null;
  createdAt: number;
  lastActivity: number;
}

interface MatchRequest {
  socketId: string;
  userId: number;
  username: string;
}

interface SocketUser {
  id: number;
  username: string;
  role: string;
}

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function genCode(): string {
  let out = '';
  for (let i = 0; i < 6; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

function slotOf(room: GameRoom, userId: number): number {
  return room.players.findIndex((p) => p.userId === userId);
}

export function attachSocket(io: Server, cfg: Config, repo: Repo): void {
  const rooms = new Map<string, GameRoom>();
  const queues = new Map<string, MatchRequest[]>();
  const socketRooms = new Map<string, string>();
  const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const payload = token ? verifyToken(cfg, token) : null;
    if (!payload) return next(new Error('unauthorized'));
    (socket.data.user as SocketUser) = { id: Number(payload.sub), username: payload.username, role: payload.role };
    return next();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as SocketUser;
    repo.touchLastSeen(user.id);

    socket.on('mm:join', (payload) => {
      try {
        const game = String(payload?.game ?? '') as GameKind;
        const mode = payload?.mode === 'ranked' ? 'ranked' : 'casual';
        if (!isOnlineGame(game)) return socket.emit('mm:error', { message: 'Jeu non disponible en ligne.' });
        const adapter = adapters[game];
        if (adapter.meta.maxPlayers < 2) return socket.emit('mm:error', { message: 'Ce jeu nécessite au moins 2 joueurs.' });
        leaveQueue(socket.id);
        const key = `${game}:${mode}`;
        const list = queues.get(key) ?? [];
        list.push({ socketId: socket.id, userId: user.id, username: user.username });
        queues.set(key, list);
        socket.emit('mm:queued', { game, mode });
        tryMatch(game, mode);
      } catch (err) {
        socket.emit('mm:error', { message: err instanceof Error ? err.message : 'Erreur.' });
      }
    });

    socket.on('mm:cancel', () => leaveQueue(socket.id));

    socket.on('room:create', (payload) => {
      try {
        const game = String(payload?.game ?? '') as GameKind;
        const mode = payload?.mode === 'ranked' ? 'ranked' : 'private';
        if (!isOnlineGame(game)) return socket.emit('room:error', { message: 'Jeu non disponible en ligne.' });
        const adapter = adapters[game];
        if (adapter.meta.maxPlayers < 2) return socket.emit('room:error', { message: 'Ce jeu nécessite au moins 2 joueurs.' });
        leaveQueue(socket.id);
        const existing = rooms.get(socketRooms.get(socket.id) ?? '');
        if (existing) {
          socket.emit('room:error', { message: 'Vous êtes déjà dans une salle.' });
          return;
        }
        let code = genCode();
        while (rooms.has(code)) code = genCode();
        const room: GameRoom = {
          code,
          game,
          mode,
          hostId: user.id,
          status: 'lobby',
          players: [{ userId: user.id, connected: true }],
          state: null,
          seed: Math.floor(Math.random() * 0xffffffff),
          rng: Math.random,
          matchId: null,
          createdAt: Date.now(),
          lastActivity: Date.now(),
        };
        rooms.set(code, room);
        socketRooms.set(socket.id, code);
        socket.join(`room:${code}`);
        socket.emit('room:created', { code, room: publicRoom(room) });
      } catch (err) {
        socket.emit('room:error', { message: err instanceof Error ? err.message : 'Erreur.' });
      }
    });

    socket.on('room:join', (payload) => {
      try {
        const code = String(payload?.code ?? '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) return socket.emit('room:error', { message: 'Salle introuvable.' });
        if (room.status !== 'lobby') return socket.emit('room:error', { message: 'Partie déjà commencée.' });
        const max = adapters[room.game].meta.maxPlayers;
        if (room.players.length >= max) return socket.emit('room:error', { message: 'Salle complète.' });
        if (room.players.some((p) => p.userId === user.id)) {
          socketRooms.set(socket.id, code);
          socket.join(`room:${code}`);
          socket.emit('room:joined', { code, room: publicRoom(room) });
          return;
        }
        if (repo.getActiveBan(user.id)) return socket.emit('room:error', { message: 'Compte banni.' });
        leaveQueue(socket.id);
        room.players.push({ userId: user.id, connected: true });
        room.lastActivity = Date.now();
        socketRooms.set(socket.id, code);
        socket.join(`room:${code}`);
        socket.emit('room:joined', { code, room: publicRoom(room) });
        io.to(`room:${code}`).emit('room:update', { room: publicRoom(room) });
      } catch (err) {
        socket.emit('room:error', { message: err instanceof Error ? err.message : 'Erreur.' });
      }
    });

    socket.on('room:leave', () => {
      leaveRoom(socket.id);
    });

    socket.on('game:start', () => {
      try {
        const room = currentRoom(socket.id);
        if (!room) return socket.emit('room:error', { message: 'Aucune salle.' });
        if (room.status !== 'lobby') return socket.emit('room:error', { message: 'Partie déjà commencée.' });
        if (room.hostId !== user.id) return socket.emit('room:error', { message: 'Seul l\'hôte peut démarrer.' });
        const min = adapters[room.game].meta.minPlayers;
        if (room.players.length < min) return socket.emit('room:error', { message: `Au moins ${min} joueurs requis.` });
        startMatch(room);
      } catch (err) {
        socket.emit('room:error', { message: err instanceof Error ? err.message : 'Erreur.' });
      }
    });

    socket.on('game:action', (payload) => {
      try {
        const room = currentRoom(socket.id);
        if (!room || room.status !== 'playing') return socket.emit('game:error', { message: 'Partie non active.' });
        const slot = slotOf(room, user.id);
        if (slot < 0) return socket.emit('game:error', { message: 'Vous n\'êtes pas dans cette partie.' });
        const adapter = adapters[room.game];
        const action = payload?.action;
        if (action === undefined || action === null) return socket.emit('game:error', { message: 'Action invalide.' });
        const before = room.state;
        const out = adapter.apply(before, action, String(user.id), room.rng);
        room.state = out.state;
        if (room.game === 'quiz') {
          const qs = room.state as QuizState;
          if (qs.phase === 'question' && qs.status === 'playing' && Date.now() - qs.questionStartMs > qs.durationMs) {
            room.state = advanceQuiz(room.state as QuizState, qs.questionStartMs + qs.durationMs);
          }
        }
        room.lastActivity = Date.now();
        const result = adapter.winner(out.state);
        if (room.matchId) repo.addMatchMove(room.matchId, slot, JSON.stringify(action));
        broadcastGame(io, room);
        if (adapter.isFinished(out.state)) {
          finishMatch(room, result);
        }
      } catch (err) {
        socket.emit('game:error', { message: err instanceof Error ? err.message : 'Action refusée.' });
      }
    });

    socket.on('game:resign', () => {
      const room = currentRoom(socket.id);
      if (!room || room.status !== 'playing') return;
      resignPlayer(room, user.id, 'resigned');
    });

    socket.on('game:rematch', () => {
      const room = currentRoom(socket.id);
      if (!room || room.status !== 'finished') return;
      room.players.forEach((p) => (p.connected = true));
      startMatch(room);
    });

    socket.on('game:ai', (payload) => {
      try {
        const room = currentRoom(socket.id);
        if (!room || room.status !== 'playing') return;
        const adapter = adapters[room.game];
        const ai = adapter.chooseAi(room.state, (payload?.difficulty as AiDifficulty) ?? 'medium', room.rng, String(user.id));
        if (!ai) return;
        const out = adapter.apply(room.state, ai, String(user.id), room.rng);
        room.state = out.state;
        room.lastActivity = Date.now();
        const result = adapter.winner(out.state);
        if (room.matchId) repo.addMatchMove(room.matchId, slotOf(room, user.id), JSON.stringify(ai));
        broadcastGame(io, room);
        if (adapter.isFinished(out.state)) finishMatch(room, result);
      } catch {
        /* ignore AI errors */
      }
    });

    socket.on('disconnect', () => {
      const room = currentRoom(socket.id);
      if (room) {
        const player = room.players.find((p) => p.userId === user.id);
        if (player) player.connected = false;
        socketRooms.delete(socket.id);
        io.to(`room:${room.code}`).emit('room:presence', { userId: user.id, connected: false });
        if (room.status === 'playing') {
          const timer = setTimeout(() => {
            const r = rooms.get(room.code);
            if (r && r.status === 'playing') {
              const still = r.players.filter((p) => p.connected);
              if (still.length >= 2) resignPlayer(r, user.id, 'timeout');
              else abandonRoom(r);
            }
          }, 45_000);
          disconnectTimers.set(room.code, timer);
        }
      }
      leaveQueue(socket.id);
    });

    // reconnect: rejoin room if user is a player
    socket.on('room:reconnect', (payload) => {
      const code = String(payload?.code ?? '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) return;
      const player = room.players.find((p) => p.userId === user.id);
      if (!player) return;
      player.connected = true;
      const timer = disconnectTimers.get(code);
      if (timer) {
        clearTimeout(timer);
        disconnectTimers.delete(code);
      }
      socketRooms.set(socket.id, code);
      socket.join(`room:${code}`);
      io.to(`room:${code}`).emit('room:presence', { userId: user.id, connected: true });
      emitGameState(io, room);
    });
  });

  function isOnlineGame(game: GameKind): boolean {
    return game in adapters && adapters[game].meta.online;
  }

  function currentRoom(socketId: string): GameRoom | null {
    const code = socketRooms.get(socketId);
    return code ? rooms.get(code) ?? null : null;
  }

  function leaveQueue(socketId: string): void {
    for (const [key, list] of queues) {
      const next = list.filter((m) => m.socketId !== socketId);
      if (next.length === 0) queues.delete(key);
      else queues.set(key, next);
    }
  }

  function tryMatch(game: GameKind, mode: 'casual' | 'ranked'): void {
    const key = `${game}:${mode}`;
    const list = queues.get(key);
    if (!list || list.length < 2) return;
    const a = list.shift()!;
    const b = list.shift()!;
    if (list.length > 0) queues.set(key, list);
    else queues.delete(key);
    let code = genCode();
    while (rooms.has(code)) code = genCode();
    const room: GameRoom = {
      code,
      game,
      mode,
      hostId: a.userId,
      status: 'lobby',
      players: [
        { userId: a.userId, connected: true },
        { userId: b.userId, connected: true },
      ],
      state: null,
      seed: Math.floor(Math.random() * 0xffffffff),
      rng: Math.random,
      matchId: null,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    rooms.set(code, room);
    for (const m of [a, b]) {
      const sock = io.sockets.sockets.get(m.socketId);
      if (sock) {
        socketRooms.set(m.socketId, code);
        sock.join(`room:${code}`);
        sock.emit('mm:found', { code, room: publicRoom(room) });
      }
    }
    startMatch(room);
  }

  function startMatch(room: GameRoom): void {
    const adapter = adapters[room.game];
    const playerIds = room.players.map((p) => String(p.userId));
    room.seed = Math.floor(Math.random() * 0xffffffff);
    room.rng = mulberry32(room.seed);
    const config =
      room.game === 'quiz'
        ? { playerIds, questions: buildQuizQuestions(repo, 10) }
        : { playerIds, seed: room.seed };
    room.state = adapter.create(config as never);
    room.status = 'playing';
    room.matchId = null;
    room.lastActivity = Date.now();
    room.players.forEach((p) => (p.connected = true));
    const matchId = repo.createMatchRow(room.game, room.mode);
    room.matchId = matchId;
    playerIds.forEach((id, slot) => repo.addMatchPlayer(matchId, Number(id), slot));
    broadcastGame(io, room);
  }

  function buildQuizQuestions(r: Repo, count: number) {
    return r.getRandomQuestions(count, []).map((q) => ({
      id: String(q.id),
      category: String(q.categoryId),
      text: q.text,
      answers: q.answers,
      correctIndex: q.correctIndex,
      difficulty: q.difficulty === 'easy' ? 1 : q.difficulty === 'hard' ? 3 : 2,
    }));
  }

  function broadcastGame(server: Server, room: GameRoom): void {
    emitGameState(server, room);
  }

  function emitGameState(server: Server, room: GameRoom): void {
    const roomSockets = server.sockets.adapter.rooms.get(`room:${room.code}`);
    const targetRoom = `room:${room.code}`;
    server.in(targetRoom).fetchSockets().then((sockets) => {
      for (const s of sockets) {
        const u = s.data.user as SocketUser | undefined;
        if (!u) continue;
        const slot = slotOf(room, u.id);
        const visible = slot >= 0 ? visibleState(room, slot) : room.state;
        s.emit('game:state', { code: room.code, state: visible, seed: room.seed, yourSlot: slot >= 0 ? slot : null });
      }
    }).catch(() => {
      /* room may be gone */
    });
  }

  function visibleState(room: GameRoom, mySlot: number): unknown {
    const st = room.state as Record<string, unknown>;
    if (room.game === 'uno') {
      const hands = (st.hands as unknown[][]).map((h, i) => (i === mySlot ? h : h.map(() => null)));
      const drawPile = (st.drawPile as unknown[]).map(() => null);
      return { ...st, hands, drawPile };
    }
    if (room.game === 'domino') {
      const hands = (st.hands as unknown[][]).map((h, i) => (i === mySlot ? h : h.map(() => null)));
      return { ...st, hands };
    }
    if (room.game === 'quiz') {
      const finished = st.status === 'finished' || st.phase === 'finished';
      const questions = (st.questions as Array<Record<string, unknown>>).map((q) => ({ ...q, correctIndex: undefined }));
      const answers = (st.answers as (number | null)[][]).map((row, i) =>
        i === mySlot || finished ? row : row.map((a) => (a === null ? null : undefined)),
      );
      return { ...st, questions, answers };
    }
    return st;
  }

  function finishMatch(room: GameRoom, winnerId: string | null): void {
    room.status = 'finished';
    room.lastActivity = Date.now();
    const adapter = adapters[room.game];
    const ranking = adapter.ranking(room.state) as string[];
    const results: Array<{ userId: number; slot: number; result: 'win' | 'draw' | 'loss' }> = room.players.map((p) => {
      const slot = slotOf(room, p.userId);
      const pid = String(p.userId);
      const result = winnerId === null ? 'draw' : pid === winnerId ? 'win' : 'loss';
      return { userId: p.userId, slot, result };
    });
    if (room.matchId) {
      svc.recordMatch(repo, room.game, room.mode, results, winnerId ? Number(winnerId) : null, {
        ranking,
        seed: room.seed,
      });
      for (const p of room.players) {
        const pid = String(p.userId);
        if (winnerId !== null && pid !== winnerId) {
          repo.createNotification(p.userId, 'match_result', 'Partie terminée', `Défaite — ${adapter.meta.name}.`);
        }
      }
    }
    io.in(`room:${room.code}`).fetchSockets().then((sockets) => {
      for (const s of sockets) {
        const u = s.data.user as SocketUser | undefined;
        if (!u) continue;
        const slot = slotOf(room, u.id);
        const visible = slot >= 0 ? visibleState(room, slot) : room.state;
        s.emit('game:finished', { code: room.code, state: visible, winner: winnerId, ranking, you: u.id, yourSlot: slot });
      }
    }).catch(() => undefined);
  }

  function resignPlayer(room: GameRoom, userId: number, reason: string): void {
    const loserId = String(userId);
    const winnerId = room.players.find((p) => p.userId !== userId)?.userId ?? null;
    const finish = () => {
      room.status = 'finished';
      room.lastActivity = Date.now();
      const ranking = [String(winnerId), loserId];
      const results = room.players.map((p) => ({
        userId: p.userId,
        slot: slotOf(room, p.userId),
        result: (winnerId === null || p.userId !== winnerId ? 'loss' : 'win') as 'win' | 'loss',
      }));
      if (room.matchId) {
        svc.recordMatch(repo, room.game, room.mode, results, winnerId, { ranking, reason });
      }
      io.in(`room:${room.code}`).emit('game:finished', {
        code: room.code,
        winner: String(winnerId),
        ranking,
        reason,
        you: null,
      });
    };
    finish();
  }

  function abandonRoom(room: GameRoom): void {
    room.status = 'abandoned';
    const remaining = room.players.filter((p) => p.connected);
    const winnerId = remaining.length === 1 ? remaining[0].userId : null;
    if (winnerId !== null && room.matchId) {
      const results = room.players.map((p) => ({
        userId: p.userId,
        slot: slotOf(room, p.userId),
        result: (p.userId === winnerId ? 'win' : 'loss') as 'win' | 'loss',
      }));
      svc.recordMatch(repo, room.game, room.mode, results, winnerId, { ranking: [String(winnerId)], reason: 'abandon' });
    }
    io.in(`room:${room.code}`).emit('game:finished', { code: room.code, winner: winnerId ? String(winnerId) : null, reason: 'abandon' });
  }

  function leaveRoom(socketId: string): void {
    const code = socketRooms.get(socketId);
    if (!code) return;
    const room = rooms.get(code);
    socketRooms.delete(socketId);
    if (!room) return;
    const sock = io.sockets.sockets.get(socketId);
    if (sock) sock.leave(`room:${code}`);
    if (room.status === 'lobby') {
      const idx = room.players.findIndex((p) => p.userId === (sock?.data.user as SocketUser | undefined)?.id);
      if (idx >= 0) room.players.splice(idx, 1);
      if (room.players.length === 0) {
        rooms.delete(code);
        return;
      }
      if ((sock?.data.user as SocketUser | undefined)?.id === room.hostId) {
        room.hostId = room.players[0].userId;
      }
      io.to(`room:${code}`).emit('room:update', { room: publicRoom(room) });
    }
  }

  function publicRoom(room: GameRoom) {
    return {
      code: room.code,
      game: room.game,
      mode: room.mode,
      hostId: room.hostId,
      status: room.status,
      players: room.players.map((p) => {
        const u = repo.findUserById(p.userId);
        return {
          userId: p.userId,
          username: u?.username ?? String(p.userId),
          avatar_emoji: u?.avatar_emoji ?? '🎮',
          avatar_color: u?.avatar_color ?? '#6c5ce7',
          connected: p.connected,
        };
      }),
    };
  }
}
