import { GameStatus, GameEvent } from '../../core/types';

export type Cell = '' | 'b' | 'w' | 'B' | 'W';

export interface CheckersState {
  board: Cell[];
  turn: 0 | 1;
  mustCapture: number | null;
  halfmove: number;
  fullmove: number;
  status: GameStatus;
  result?: { winner: string | null; reason: string };
  playerIds: string[];
  history: { move: CheckersMove; captured: number[] }[];
}

export interface CheckersMove {
  from: number;
  to: number;
}

export interface CheckersConfig {
  playerIds: string[];
}

function isMan(c: Cell): boolean {
  return c === 'b' || c === 'w';
}
export function isKing(c: Cell): boolean {
  return c === 'B' || c === 'W';
}
export function colorOf(c: Cell): 0 | 1 | null {
  if (c === 'b' || c === 'B') return 0;
  if (c === 'w' || c === 'W') return 1;
  return null;
}

const DIAG = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export function createCheckersState(config: CheckersConfig): CheckersState {
  const board: Cell[] = new Array(64).fill('');
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      if ((r + f) % 2 === 1) {
        if (r < 3) board[r * 8 + f] = 'w'; // player 1 top rows
        else if (r > 4) board[r * 8 + f] = 'b'; // player 0 bottom rows
      }
    }
  }
  return {
    board,
    turn: 0,
    mustCapture: null,
    halfmove: 0,
    fullmove: 1,
    status: 'playing',
    playerIds: config.playerIds.slice(0, 2),
    history: [],
  };
}

function forwardDir(color: 0 | 1): number {
  return color === 0 ? -1 : 1; // player 0 ('b', bottom) moves up
}

function capturableLanding(board: Cell[], from: number, df: number, dr: number): { over: number; to: number } | null {
  const f = from % 8;
  const r = Math.floor(from / 8);
  const cf = f + df;
  const cr = r + dr;
  const lf = f + 2 * df;
  const lr = r + 2 * dr;
  if (cf < 0 || cf > 7 || cr < 0 || cr > 7 || lf < 0 || lf > 7 || lr < 0 || lr > 7) return null;
  const over = cr * 8 + cf;
  const to = lr * 8 + lf;
  return { over, to };
}

export function getCheckersMoves(state: CheckersState, playerId?: string): CheckersMove[] {
  if (state.status === 'finished') return [];
  const color = playerId !== undefined ? state.playerIds.indexOf(playerId) : state.turn;
  if (color !== state.turn) return [];
  const { board } = state;
  const playerCells = new Set(color === 0 ? ['b', 'B'] : ['w', 'W']);
  const dir = forwardDir(color);

  const captures: CheckersMove[] = [];
  const simples: CheckersMove[] = [];

  const scan = (sq: number) => {
    const c = board[sq];
    const king = isKing(c);
    for (const [df, dr] of DIAG) {
      if (!king && dr !== dir) continue; // men only forward
      const land = capturableLanding(board, sq, df, dr);
      if (land) {
        const overColor = colorOf(board[land.over]);
        if (overColor !== null && overColor !== color && board[land.to] === '') {
          captures.push({ from: sq, to: land.to });
        }
      }
      if (!king && dr !== dir) continue;
      const f = sq % 8;
      const r = Math.floor(sq / 8);
      const cf = f + df;
      const cr = r + dr;
      if (cf >= 0 && cf <= 7 && cr >= 0 && cr <= 7) {
        const t = cr * 8 + cf;
        if (board[t] === '') simples.push({ from: sq, to: t });
      }
    }
  };

  if (state.mustCapture !== null) {
    if (playerCells.has(board[state.mustCapture])) scan(state.mustCapture);
    return captures;
  }

  for (let i = 0; i < 64; i++) {
    if (playerCells.has(board[i])) scan(i);
  }
  return captures.length > 0 ? captures : simples;
}

export interface CheckersOutcome {
  state: CheckersState;
  events: GameEvent[];
  finished: boolean;
  winner: string | null;
}

export function applyCheckersMove(state: CheckersState, move: CheckersMove, playerId?: string): CheckersOutcome {
  if (state.status === 'finished') {
    return { state, events: [], finished: true, winner: state.result?.winner ?? null };
  }
  const legal = getCheckersMoves(state, playerId);
  if (!legal.some((m) => m.from === move.from && m.to === move.to)) throw new Error('illegal_move');

  const board = state.board.slice();
  const piece = board[move.from];
  const isCapture = Math.abs(Math.floor(move.to / 8) - Math.floor(move.from / 8)) === 2;
  const capturedSqs: number[] = [];
  if (isCapture) {
    const mid = (move.from + move.to) / 2;
    capturedSqs.push(mid);
    board[mid] = '';
  }
  // promotion
  let promoted = false;
  let p = piece;
  const destRow = Math.floor(move.to / 8);
  if (p === 'b' && destRow === 0) {
    p = 'B';
    promoted = true;
  } else if (p === 'w' && destRow === 7) {
    p = 'W';
    promoted = true;
  }
  board[move.to] = p;
  board[move.from] = '';

  const events: GameEvent[] = [{ type: 'move', data: { from: move.from, to: move.to, capture: isCapture } }];

  let turn: 0 | 1 = state.turn;
  let mustCapture: number | null = null;
  const halfmove = isCapture ? 0 : state.halfmove + 1;
  let fullmove = state.fullmove;
  if (isCapture && !promoted) {
    // check for further captures by same piece
    const next = { ...state, board, mustCapture: move.to };
    const cont = getCheckersMoves(next, undefined).filter((m) => m.from === move.to);
    if (cont.length > 0) {
      mustCapture = move.to;
    } else {
      turn = state.turn === 0 ? 1 : 0;
      fullmove = state.turn === 1 ? state.fullmove + 1 : state.fullmove;
    }
  } else {
    turn = state.turn === 0 ? 1 : 0;
    fullmove = state.turn === 1 ? state.fullmove + 1 : state.fullmove;
  }

  let next: CheckersState = {
    ...state,
    board,
    turn,
    mustCapture,
    halfmove,
    fullmove,
    history: [...state.history, { move, captured: capturedSqs }],
  };

  // outcome
  let finished = false;
  let winner: string | null = null;
  let result: CheckersState['result'];

  if (mustCapture === null) {
    const opponent = turn;
    const hasPieces = board.some((c) => {
      const col = colorOf(c);
      return col === opponent;
    });
    const oppMoves = getCheckersMoves(next, undefined);
    if (!hasPieces || oppMoves.length === 0) {
      winner = state.playerIds[state.turn];
      result = { winner, reason: hasPieces ? 'no_moves' : 'no_pieces' };
      finished = true;
      events.push({ type: 'game_over', data: { winner } });
    } else if (halfmove >= 40) {
      result = { winner: null, reason: 'draw' };
      events.push({ type: 'draw' });
      finished = true;
    } else if (fullmove >= 100) {
      result = { winner: null, reason: 'draw' };
      events.push({ type: 'draw' });
      finished = true;
    }
  }

  next.status = finished ? 'finished' : 'playing';
  next.result = result;
  return { state: next, events, finished, winner };
}
