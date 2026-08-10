import { io, type Socket } from 'socket.io-client';
import type { GameKind } from '@shared/index';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export interface RoomPlayer {
  userId: number;
  username: string;
  avatar_emoji: string;
  avatar_color: string;
  connected: boolean;
}

export interface PublicRoom {
  code: string;
  game: GameKind;
  mode: 'casual' | 'ranked' | 'private';
  hostId: number;
  status: 'lobby' | 'playing' | 'finished' | 'abandoned';
  players: RoomPlayer[];
}

export interface GameStateMsg {
  code: string;
  state: unknown;
  seed: number;
  yourSlot: number | null;
}

export interface FinishedMsg {
  code: string;
  state?: unknown;
  winner: string | null;
  ranking: string[];
  reason?: string;
  you?: number;
  yourSlot?: number;
}

export class OnlineSession {
  socket: Socket;
  onRoom: (room: PublicRoom) => void = () => {};
  onState: (msg: GameStateMsg) => void = () => {};
  onFinished: (msg: FinishedMsg) => void = () => {};
  onPresence: (userId: number, connected: boolean) => void = () => {};
  onError: (message: string) => void = () => {};
  onQueued: () => void = () => {};

  private room: PublicRoom | null = null;
  code: string | null = null;

  constructor(token: string) {
    this.socket = io(BASE, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
    });
    this.socket.on('room:update', (m: { room: PublicRoom }) => {
      this.room = m.room;
      this.onRoom(m.room);
    });
    this.socket.on('room:created', (m: { code: string; room: PublicRoom }) => {
      this.code = m.code;
      this.room = m.room;
      this.onRoom(m.room);
    });
    this.socket.on('room:joined', (m: { code: string; room: PublicRoom }) => {
      this.code = m.code;
      this.room = m.room;
      this.onRoom(m.room);
    });
    this.socket.on('mm:found', (m: { code: string; room: PublicRoom }) => {
      this.code = m.code;
      this.room = m.room;
      this.onRoom(m.room);
    });
    this.socket.on('mm:queued', () => this.onQueued());
    this.socket.on('room:presence', (m: { userId: number; connected: boolean }) => this.onPresence(m.userId, m.connected));
    this.socket.on('game:state', (m: GameStateMsg) => this.onState(m));
    this.socket.on('game:finished', (m: FinishedMsg) => this.onFinished(m));
    this.socket.on('room:error', (m: { message: string }) => this.onError(m.message));
    this.socket.on('mm:error', (m: { message: string }) => this.onError(m.message));
    this.socket.on('game:error', (m: { message: string }) => this.onError(m.message));
    this.socket.on('disconnect', () => this.onError('Déconnecté du serveur.'));
  }

  getRoom(): PublicRoom | null {
    return this.room;
  }

  createRoom(game: GameKind, mode: 'ranked' | 'private'): void {
    this.socket.emit('room:create', { game, mode });
  }

  joinRoom(code: string): void {
    this.socket.emit('room:join', { code });
  }

  joinMatchmaking(game: GameKind, mode: 'casual' | 'ranked'): void {
    this.socket.emit('mm:join', { game, mode });
  }

  cancelMatchmaking(): void {
    this.socket.emit('mm:cancel');
  }

  startGame(): void {
    this.socket.emit('game:start');
  }

  sendAction(action: unknown): void {
    this.socket.emit('game:action', { action });
  }

  resign(): void {
    this.socket.emit('game:resign');
  }

  rematch(): void {
    this.socket.emit('game:rematch');
  }

  leave(): void {
    if (this.code) this.socket.emit('room:leave');
    this.socket.disconnect();
  }

  reconnect(code: string): void {
    this.code = code;
    this.socket.emit('room:reconnect', { code });
  }

  connected(): boolean {
    return this.socket.connected;
  }
}
