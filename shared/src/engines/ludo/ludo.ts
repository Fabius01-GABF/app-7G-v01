import { GameStatus, GameEvent } from '../../core/types';

export const LUDO_RING = 52;
export const LUDO_JOURNEY = 57; // 0..50 ring, 51..55 home ramp, 56 = home

export type LudoAction = { type: 'roll' } | { type: 'move'; pawn: number } | { type: 'pass' };

export interface LudoState {
  playerIds: string[];
  pawns: number[]; // journey for each pawn (player*4+pawn); -1 = in base, 56 = home
  turn: number;
  dice: number | null;
  phase: 'roll' | 'move';
  status: GameStatus;
  result?: { winner: string; rank: string[] };
  history: string[];
  eventLog: GameEvent[];
}

export interface LudoConfig {
  playerIds: string[];
}

export function safeSquares(): Set<number> {
  const s = new Set<number>();
  for (let p = 0; p < 4; p++) {
    s.add((p * 13) % 52);
    s.add((p * 13 + 8) % 52);
  }
  return s;
}

export function ringPos(player: number, journey: number): number {
  if (journey < 0 || journey > 50) return -1;
  return (player * 13 + journey) % 52;
}

export function createLudoState(config: LudoConfig): LudoState {
  const count = Math.min(4, Math.max(2, config.playerIds.length));
  const pawns = new Array<number>(count * 4).fill(-1);
  return {
    playerIds: config.playerIds.slice(0, count),
    pawns,
    turn: 0,
    dice: null,
    phase: 'roll',
    status: 'playing',
    history: [],
    eventLog: [],
  };
}

function movablePawns(state: LudoState): number[] {
  const d = state.dice;
  if (d === null) return [];
  const res: number[] = [];
  for (let i = 0; i < state.pawns.length; i++) {
    if (Math.floor(i / 4) !== state.turn) continue;
    const j = state.pawns[i];
    if (j === -1) {
      if (d === 6) res.push(i);
    } else if (j === 56) {
      continue;
    } else {
      if (j + d <= 56) res.push(i);
    }
  }
  return res;
}

export function getLudoActions(state: LudoState, playerId?: string): LudoAction[] {
  if (state.status === 'finished') return [];
  const turn = playerId !== undefined ? state.playerIds.indexOf(playerId) : state.turn;
  if (turn !== state.turn) return [];
  if (state.phase === 'roll') return [{ type: 'roll' }];
  const movables = movablePawns(state);
  if (movables.length === 0) return [{ type: 'pass' }];
  return movables.map((pawn) => ({ type: 'move', pawn }));
}

function pawnAt(state: LudoState, player: number, journey: number): number[] {
  const res: number[] = [];
  for (let i = 0; i < state.pawns.length; i++) {
    if (Math.floor(i / 4) === player && state.pawns[i] === journey) res.push(i);
  }
  return res;
}

export function applyLudoAction(state: LudoState, action: LudoAction, playerId?: string, rng: () => number = Math.random): { state: LudoState; events: GameEvent[] } {
  if (state.status === 'finished') return { state, events: [] };
  const turn = playerId !== undefined ? state.playerIds.indexOf(playerId) : state.turn;
  if (turn !== state.turn) throw new Error('not_your_turn');

  const events: GameEvent[] = [];

  if (action.type === 'roll') {
    if (state.phase !== 'roll') throw new Error('invalid_action');
    const dice = 1 + Math.floor(rng() * 6);
    events.push({ type: 'roll', playerId: state.playerIds[turn], data: { dice } });
    const movable = movablePawns({ ...state, dice, phase: 'move' });
    let phase: 'roll' | 'move' = 'move';
    if (movable.length === 0) {
      phase = 'roll';
      const nextTurn = turn === state.playerIds.length - 1 ? 0 : turn + 1;
      const s2: LudoState = {
        ...state,
        dice,
        phase: 'roll',
        turn: nextTurn,
        history: [...state.history, `P${turn} rolls ${dice} (no move)`],
        eventLog: [...state.eventLog, ...events],
      };
      return { state: s2, events };
    }
    const s: LudoState = { ...state, dice, phase, history: [...state.history, `P${turn} rolls ${dice}`], eventLog: [...state.eventLog, ...events] };
    return { state: s, events };
  }

  if (action.type === 'pass') {
    if (state.phase !== 'move' || movablePawns(state).length > 0) throw new Error('invalid_action');
    const nextTurn = turn === state.playerIds.length - 1 ? 0 : turn + 1;
    events.push({ type: 'pass', playerId: state.playerIds[turn] });
    const s: LudoState = { ...state, phase: 'roll', turn: nextTurn, history: [...state.history, `P${turn} passes`], eventLog: [...state.eventLog, ...events] };
    return { state: s, events };
  }

  // move
  if (state.phase !== 'move') throw new Error('invalid_action');
  const pawn = action.pawn;
  if (pawn < 0 || pawn >= state.pawns.length || Math.floor(pawn / 4) !== state.turn) throw new Error('not_your_pawn');
  const j = state.pawns[pawn];
  const d = state.dice;
  if (d === null) throw new Error('invalid_action');
  const legal = movablePawns(state);
  if (!legal.includes(pawn)) throw new Error('illegal_move');

  let nj: number;
  if (j === -1) {
    nj = 0;
  } else {
    nj = j + d;
  }
  if (nj > 56) throw new Error('illegal_move');

  const pawns = state.pawns.slice();
  pawns[pawn] = nj;
  events.push({ type: 'move', playerId: state.playerIds[turn], data: { pawn: action.pawn, from: j, to: nj, dice: d } });

  // captures: only on ring squares (0..50), not safe, not own, single pawn there
  if (nj <= 50) {
    const ring = ringPos(turn, nj);
    const safe = safeSquares();
    if (!safe.has(ring)) {
      for (let i = 0; i < pawns.length; i++) {
        const other = Math.floor(i / 4);
        if (other !== turn && pawns[i] >= 0 && pawns[i] <= 50 && ringPos(other, pawns[i]) === ring) {
          pawns[i] = -1;
          events.push({ type: 'capture', playerId: state.playerIds[turn], data: { victim: state.playerIds[other] } });
        }
      }
    }
  }

  let next = { ...state, pawns };

  // check victory
  const playerPawns = next.pawns.filter((_, i) => Math.floor(i / 4) === turn);
  let winner: string | undefined;
  if (playerPawns.every((p) => p === 56)) {
    winner = state.playerIds[turn];
    next.result = { winner, rank: rankOf(next) };
    next.status = 'finished';
    events.push({ type: 'game_over', playerId: winner, data: { winner } });
    next.history = [...next.history, `P${turn} wins`];
    next.eventLog = [...next.eventLog, ...events];
    return { state: next, events };
  }

  // next turn: 6 = roll again
  if (d === 6) {
    next.phase = 'roll';
    next.dice = null;
    next.eventLog = [...next.eventLog, ...events];
    next.history = [...next.history, `P${turn} rolls again`];
    return { state: next, events };
  }
  const nextTurn = turn === state.playerIds.length - 1 ? 0 : turn + 1;
  next = { ...next, turn: nextTurn, phase: 'roll', dice: null };
  next.history = [...next.history, `P${turn} to ${d}`];
  next.eventLog = [...next.eventLog, ...events];
  return { state: next, events };
}

function rankOf(state: LudoState): string[] {
  return state.playerIds
    .map((id, p) => {
      const home = state.pawns.filter((_, i) => Math.floor(i / 4) === p && state.pawns[i] === 56).length;
      const maxRing = Math.max(...state.pawns.filter((_, i) => Math.floor(i / 4) === p && state.pawns[i] !== 56 && state.pawns[i] !== -1).map((v) => v), -1);
      return { id, home, maxRing };
    })
    .sort((a, b) => b.home - a.home || b.maxRing - a.maxRing)
    .map((x) => x.id);
}

export function ludoRanking(state: LudoState): string[] {
  if (state.result) return state.result.rank;
  return rankOf(state);
}
