export type PlayerId = string;

export type GameStatus = 'playing' | 'finished';

export interface GameEvent {
  type: string;
  playerId?: PlayerId;
  data?: unknown;
}

export interface EngineResult<S> {
  state: S;
  events: GameEvent[];
}

export interface EngineMeta {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  solo: boolean;
  local: boolean;
  online: boolean;
  durationMin: number;
}

export interface GameConfig {
  playerIds: PlayerId[];
  rng?: () => number;
  [key: string]: unknown;
}
