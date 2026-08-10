import { GameStatus, GameEvent } from '../../core/types';
import { shuffle } from '../../core/rng';

export interface DominoTile {
  a: number;
  b: number;
}

export const DOMINO_TILES: DominoTile[] = (() => {
  const tiles: DominoTile[] = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      tiles.push({ a, b });
    }
  }
  return tiles;
})();

export interface DominoState {
  playerIds: string[];
  hands: number[][]; // tile indices
  boneyard: number[];
  chain: DominoTile[];
  leftEnd: number | null;
  rightEnd: number | null;
  turn: number;
  scores: number[];
  round: number;
  passed: number;
  status: GameStatus;
  result?: { winner: string; finalScores: number[] };
  eventLog: GameEvent[];
  roundWinner?: string | null;
}

export interface DominoConfig {
  playerIds: string[];
  seed?: number;
}

export type DominoAction = { type: 'play'; tile: number; end: 'left' | 'right' } | { type: 'draw' } | { type: 'pass' };

export function createDominoState(config: DominoConfig): DominoState {
  const rng = config.seed !== undefined ? seeded(config.seed) : Math.random;
  const n = Math.min(4, Math.max(2, config.playerIds.length));
  const shuffled = shuffle(DOMINO_TILES.map((_, i) => i), rng);
  const per = n <= 2 ? 7 : 6;
  const hands: number[][] = [];
  for (let i = 0; i < n; i++) hands.push(shuffled.splice(0, per));
  const boneyard = shuffled;

  // starter: highest double, else highest sum
  let startPlayer = 0;
  let startTile = -1;
  for (let p = 0; p < n; p++) {
    for (const t of hands[p]) {
      const tile = DOMINO_TILES[t];
      const isDouble = tile.a === tile.b;
      const better =
        startTile === -1 ||
        (isDouble && !(DOMINO_TILES[startTile].a === DOMINO_TILES[startTile].b)) ||
        (isDouble && DOMINO_TILES[startTile].a === DOMINO_TILES[startTile].b && tile.a > DOMINO_TILES[startTile].a) ||
        (!isDouble && !(DOMINO_TILES[startTile].a === DOMINO_TILES[startTile].b) && tile.a + tile.b > DOMINO_TILES[startTile].a + DOMINO_TILES[startTile].b);
      if (better) {
        startPlayer = p;
        startTile = t;
      }
    }
  }
  const hands2 = hands.map((h, p) => (p === startPlayer ? h.filter((t) => t !== startTile) : h.slice()));
  const chain = [{ ...DOMINO_TILES[startTile] }];
  const leftEnd = chain[0].a;
  const rightEnd = chain[0].b;
  const scores = new Array(n).fill(0);
  return {
    playerIds: config.playerIds.slice(0, n),
    hands: hands2,
    boneyard,
    chain,
    leftEnd,
    rightEnd,
    turn: (startPlayer + 1) % n,
    scores,
    round: 1,
    passed: 0,
    status: 'playing',
    eventLog: [{ type: 'start', data: { starter: config.playerIds[startPlayer], tile: startTile } }],
  };
}

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function matchesEnd(state: DominoState, tile: DominoTile, end: 'left' | 'right'): boolean {
  return end === 'left' ? tile.a === state.leftEnd || tile.b === state.leftEnd : tile.a === state.rightEnd || tile.b === state.rightEnd;
}

export function getDominoActions(state: DominoState, playerId?: string): DominoAction[] {
  if (state.status === 'finished') return [];
  const turn = playerId !== undefined ? state.playerIds.indexOf(playerId) : state.turn;
  if (turn !== state.turn) return [];
  const hand = state.hands[turn];
  const actions: DominoAction[] = [];
  for (const t of hand) {
    const tile = DOMINO_TILES[t];
    if (state.leftEnd !== null && matchesEnd(state, tile, 'left')) actions.push({ type: 'play', tile: t, end: 'left' });
    if (state.rightEnd !== null && matchesEnd(state, tile, 'right') && (state.leftEnd !== state.rightEnd || actions.some((a) => a.type === 'play' && (a.tile !== t || a.end === 'left')))) {
      actions.push({ type: 'play', tile: t, end: 'right' });
    }
  }
  if (actions.length > 0) return actions;
  if (state.boneyard.length > 0) return [{ type: 'draw' }];
  return [{ type: 'pass' }];
}

function tileSumOf(hand: number[]): number {
  return hand.reduce((sum, t) => sum + DOMINO_TILES[t].a + DOMINO_TILES[t].b, 0);
}

export function applyDominoAction(state: DominoState, action: DominoAction, playerId?: string, rng: () => number = Math.random): { state: DominoState; events: GameEvent[] } {
  if (state.status === 'finished') return { state, events: [] };
  const turn = playerId !== undefined ? state.playerIds.indexOf(playerId) : state.turn;
  if (turn !== state.turn) throw new Error('not_your_turn');
  const events: GameEvent[] = [];

  if (action.type === 'draw') {
    if (state.boneyard.length === 0) throw new Error('no_tiles');
    const tile = state.boneyard.pop()!;
    const hands = state.hands.map((h, p) => (p === turn ? [...h, tile] : h));
    const boneyard = state.boneyard.slice();
    events.push({ type: 'draw', playerId: state.playerIds[turn], data: { count: 1 } });
    let s: DominoState = { ...state, hands, boneyard };
    // still must play if possible
    if (getDominoActions(s, state.playerIds[turn]).length === 0 && boneyard.length === 0) {
      s = { ...s, passed: state.passed + 1, turn: (turn + 1) % state.playerIds.length };
      events.push({ type: 'pass', playerId: state.playerIds[turn], data: { reason: 'no_tiles' } });
      s = maybeEndRound(s, events);
    }
    s.eventLog = [...s.eventLog, ...events];
    return { state: s, events };
  }

  if (action.type === 'pass') {
    const hand = state.hands[turn];
    const hasPlay = getDominoActions(state, state.playerIds[turn]).some((a) => a.type === 'play');
    if (hasPlay) throw new Error('must_play');
    if (state.boneyard.length > 0) throw new Error('must_draw');
    events.push({ type: 'pass', playerId: state.playerIds[turn], data: { reason: 'blocked' } });
    let s: DominoState = { ...state, passed: state.passed + 1, turn: (turn + 1) % state.playerIds.length };
    s = maybeEndRound(s, events);
    s.eventLog = [...s.eventLog, ...events];
    return { state: s, events };
  }

  // play
  const hand = state.hands[turn];
  if (!hand.includes(action.tile)) throw new Error('illegal_move');
  const tile = DOMINO_TILES[action.tile];
  const legal = getDominoActions(state, state.playerIds[turn]);
  if (!legal.some((a) => a.type === 'play' && a.tile === action.tile && a.end === action.end)) throw new Error('illegal_move');

  const placed: DominoTile = action.end === 'left' ? (tile.a === state.leftEnd ? { a: tile.a, b: tile.b } : { a: tile.b, b: tile.a }) : tile.a === state.rightEnd ? { a: tile.a, b: tile.b } : { a: tile.b, b: tile.a };

  const chain = action.end === 'left' ? [placed, ...state.chain] : [...state.chain, placed];
  const leftEnd = action.end === 'left' ? placed.b : state.leftEnd;
  const rightEnd = action.end === 'right' ? placed.b : state.rightEnd;
  const hands = state.hands.map((h, p) => (p === turn ? h.filter((t) => t !== action.tile) : h));
  events.push({ type: 'play', playerId: state.playerIds[turn], data: { tile: [tile.a, tile.b], end: action.end } });

  let s: DominoState = { ...state, hands, chain, leftEnd, rightEnd, passed: 0 };

  if (hands[turn].length === 0) {
    // round won by emptying hand: winner scores the total of opponents' hands
    const emptierScore = state.playerIds.reduce((sum, _, j) => (j === turn ? sum : sum + tileSumOf(hands[j])), 0);
    const roundScore = state.playerIds.map((_, i) => (i === turn ? emptierScore : 0));
    const scores = state.scores.map((v, i) => v + roundScore[i]);
    const total = scores[turn];
    events.push({ type: 'round_end', playerId: state.playerIds[turn], data: { roundScore } });
    if (total >= 100) {
      s = { ...s, scores, status: 'finished', result: { winner: state.playerIds[turn], finalScores: scores } };
      events.push({ type: 'game_over', playerId: state.playerIds[turn], data: { winner: state.playerIds[turn] } });
    } else {
      s = { ...s, scores, roundWinner: state.playerIds[turn] };
      s = nextRound(s, events);
    }
    s.eventLog = [...s.eventLog, ...events];
    return { state: s, events };
  }

  s = { ...s, turn: (turn + 1) % state.playerIds.length };
  s.eventLog = [...s.eventLog, ...events];
  return { state: s, events };
}

function maybeEndRound(state: DominoState, events: GameEvent[]): DominoState {
  // blocked: boneyard empty and current player cannot play (all pass)
  if (state.boneyard.length > 0) return state;
  // check whether anyone can still play
  for (let p = 0; p < state.playerIds.length; p++) {
    const acts = getDominoActions({ ...state, turn: p }, state.playerIds[p]);
    if (acts.some((a) => a.type === 'play')) return state;
  }
  // full block
  const sums = state.playerIds.map((_, i) => tileSumOf(state.hands[i]));
  const min = Math.min(...sums);
  const winners = sums.map((v, i) => (v === min ? i : -1)).filter((i) => i !== -1);
  events.push({ type: 'block_end' });
  if (winners.length === 1) {
    const w = winners[0];
    // winner (lowest hand sum) scores the total of the others' hands
    const wScore = sums.reduce((a, v, i) => (i === w ? a : a + v), 0);
    const roundScore = sums.map((v, i) => (i === w ? wScore : 0));
    const scores = state.scores.map((v, i) => v + roundScore[i]);
    events.push({ type: 'round_end', playerId: state.playerIds[w], data: { roundScore, reason: 'block' } });
    if (scores[w] >= 100) {
      return { ...state, scores, status: 'finished', result: { winner: state.playerIds[w], finalScores: scores } };
    }
    return nextRound({ ...state, scores, roundWinner: state.playerIds[w] }, events);
  }
  // tie → no points, next round
  events.push({ type: 'round_end', data: { reason: 'tie' } });
  return nextRound(state, events);
}

function nextRound(state: DominoState, events: GameEvent[]): DominoState {
  const cfg: DominoConfig = { playerIds: state.playerIds };
  const fresh = createDominoState(cfg);
  const s: DominoState = {
    ...fresh,
    scores: state.scores,
    round: state.round + 1,
    eventLog: [...state.eventLog, ...events],
  };
  return s;
}
