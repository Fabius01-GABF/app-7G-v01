import { GameStatus, GameEvent } from '../../core/types';

export type Piece = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K';
export type Color = 'w' | 'b';
export type Board = string[]; // 64 squares, 'p'..'k' lowercase=black, 'P'..'K' uppercase=white, '' empty

export interface Move {
  from: number;
  to: number;
  promotion?: Piece;
}

export interface ChessState {
  board: Board;
  turn: Color;
  castling: { K: boolean; Q: boolean; k: boolean; q: boolean };
  ep: number | null;
  halfmove: number;
  fullmove: number;
  status: GameStatus;
  result?: { winner: string | null; reason: string };
  playerIds: string[];
  history: { move: Move; captured?: Piece; key: string }[];
}

export interface ChessConfig {
  playerIds: string[];
  startFen?: string;
}

export const FILES = 'abcdefgh';
export const PIECE_VALUES: Record<string, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

export function colorOf(piece: string): Color | null {
  if (piece === '') return null;
  return piece === piece.toUpperCase() ? 'w' : 'b';
}

export function squareName(idx: number): string {
  return FILES[idx % 8] + (8 - Math.floor(idx / 8));
}

export function parseSquare(name: string): number {
  const f = name.charCodeAt(0) - 97;
  const r = 8 - parseInt(name[1], 10);
  return r * 8 + f;
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

export function boardFromFen(fen: string): Board {
  const board: Board = new Array(64).fill('');
  const rows = fen.split('/');
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) {
        f += parseInt(ch, 10);
      } else {
        board[r * 8 + f] = ch;
        f++;
      }
    }
  }
  return board;
}

export function createChessState(config: ChessConfig): ChessState {
  const fen = (config.startFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1').trim().split(/\s+/);
  const turn: Color = fen[1] === 'b' ? 'b' : 'w';
  const castling = {
    K: fen[2]?.includes('K') ?? true,
    Q: fen[2]?.includes('Q') ?? true,
    k: fen[2]?.includes('k') ?? true,
    q: fen[2]?.includes('q') ?? true,
  };
  const ep = fen[3] && fen[3] !== '-' ? parseSquare(fen[3]) : null;
  return {
    board: boardFromFen(fen[0]),
    turn,
    castling,
    ep,
    halfmove: 0,
    fullmove: 1,
    status: 'playing',
    playerIds: config.playerIds.slice(0, 2),
    history: [],
  };
}

function idx(f: number, r: number): number {
  return r * 8 + f;
}

function inBounds(f: number, r: number): boolean {
  return f >= 0 && f < 8 && r >= 0 && r < 8;
}

function kingSquare(board: Board, color: Color): number {
  const king = color === 'w' ? 'K' : 'k';
  return board.indexOf(king);
}

export function isAttacked(board: Board, sq: number, byColor: Color): boolean {
  const f = sq % 8;
  const r = Math.floor(sq / 8);
  const enemyPawn = byColor === 'w' ? 'P' : 'p';
  const pawnDir = byColor === 'w' ? -1 : 1; // white pawns attack upward (decreasing rank)
  // pawn attacks
  const pr = r + pawnDir;
  if (inBounds(f - 1, pr) && board[idx(f - 1, pr)] === enemyPawn) return true;
  if (inBounds(f + 1, pr) && board[idx(f + 1, pr)] === enemyPawn) return true;

  const dirs = [
    [1, 1], [1, -1], [-1, 1], [-1, -1], // bishops/queens
    [1, 0], [-1, 0], [0, 1], [0, -1], // rooks/queens
  ];
  for (let i = 0; i < 8; i++) {
    const [df, dr] = dirs[i];
    const targets = i < 4 ? ['b', 'q'] : ['r', 'q'];
    let cf = f + df;
    let cr = r + dr;
    while (inBounds(cf, cr)) {
      const p = board[idx(cf, cr)];
      if (p !== '') {
        if (colorOf(p) === byColor) {
          const lower = p.toLowerCase();
          if (lower === targets[0] || lower === targets[1]) return true;
        }
        break;
      }
      cf += df;
      cr += dr;
    }
  }
  // knights
  const kn = [
    [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
  ];
  for (const [df, dr] of kn) {
    const cf = f + df;
    const cr = r + dr;
    if (inBounds(cf, cr)) {
      const p = board[idx(cf, cr)];
      if (p !== '' && colorOf(p) === byColor && p.toLowerCase() === 'n') return true;
    }
  }
  // king
  const kingOffsets = [
    [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
  ];
  for (const [df, dr] of kingOffsets) {
    const cf = f + df;
    const cr = r + dr;
    if (inBounds(cf, cr)) {
      const p = board[idx(cf, cr)];
      if (p !== '' && colorOf(p) === byColor && p.toLowerCase() === 'k') return true;
    }
  }
  return false;
}

export function inCheck(board: Board, color: Color): boolean {
  const ks = kingSquare(board, color);
  return ks === -1 ? false : isAttacked(board, ks, color === 'w' ? 'b' : 'w');
}

function pseudoMoves(state: ChessState): Move[] {
  const { board, turn } = state;
  const moves: Move[] = [];
  const myPieces = new Set(turn === 'w' ? 'PNBRQK' : 'pnbrqk');
  const myPawn = turn === 'w' ? 'P' : 'p';
  const startRank = turn === 'w' ? 6 : 1;
  const forward = turn === 'w' ? -1 : 1;

  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (p === '' || !myPieces.has(p)) continue;
    const f = sq % 8;
    const r = Math.floor(sq / 8);
    const type = p.toLowerCase();

    if (type === 'p') {
      const nf = f;
      const nr = r + forward;
      if (inBounds(nf, nr) && board[idx(nf, nr)] === '') {
        const promo = nr === 0 || nr === 7;
        if (promo) {
          for (const pr of ['Q', 'R', 'B', 'N'] as Piece[]) moves.push({ from: sq, to: idx(nf, nr), promotion: pr });
        } else {
          moves.push({ from: sq, to: idx(nf, nr) });
          const startRow = startRank;
          if (r === startRow) {
            const nr2 = r + forward * 2;
            if (board[idx(nf, nr2)] === '') moves.push({ from: sq, to: idx(nf, nr2) });
          }
        }
      }
      // captures
      for (const df of [-1, 1]) {
        const cf = f + df;
        const cr = r + forward;
        if (inBounds(cf, cr)) {
          const t = board[idx(cf, cr)];
          if (t !== '' && colorOf(t) !== turn) {
            const promo = cr === 0 || cr === 7;
            if (promo) {
              for (const pr of ['Q', 'R', 'B', 'N'] as Piece[]) moves.push({ from: sq, to: idx(cf, cr), promotion: pr });
            } else {
              moves.push({ from: sq, to: idx(cf, cr) });
            }
          }
          // en passant
          if (state.ep === idx(cf, cr) && t === '') {
            moves.push({ from: sq, to: idx(cf, cr) });
          }
        }
      }
    } else if (type === 'n') {
      const kn = [
        [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
      ];
      for (const [df, dr] of kn) {
        const cf = f + df;
        const cr = r + dr;
        if (inBounds(cf, cr)) {
          const t = board[idx(cf, cr)];
          if (t === '' || colorOf(t) !== turn) moves.push({ from: sq, to: idx(cf, cr) });
        }
      }
    } else if (type === 'k') {
      const kn = [
        [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
      ];
      for (const [df, dr] of kn) {
        const cf = f + df;
        const cr = r + dr;
        if (inBounds(cf, cr)) {
          const t = board[idx(cf, cr)];
          if (t === '' || colorOf(t) !== turn) moves.push({ from: sq, to: idx(cf, cr) });
        }
      }
      // castling
      if (turn === 'w' && state.castling.K && board[idx(5, 7)] === '' && board[idx(6, 7)] === '' && board[idx(7, 7)] === 'R') {
        if (!inCheck(board, 'w') && !isAttacked(board, idx(5, 7), 'b') && !isAttacked(board, idx(6, 7), 'b')) {
          moves.push({ from: idx(4, 7), to: idx(6, 7) });
        }
      }
      if (turn === 'w' && state.castling.Q && board[idx(3, 7)] === '' && board[idx(2, 7)] === '' && board[idx(1, 7)] === '' && board[idx(0, 7)] === 'R') {
        if (!inCheck(board, 'w') && !isAttacked(board, idx(3, 7), 'b') && !isAttacked(board, idx(2, 7), 'b')) {
          moves.push({ from: idx(4, 7), to: idx(2, 7) });
        }
      }
      if (turn === 'b' && state.castling.k && board[idx(5, 0)] === '' && board[idx(6, 0)] === '' && board[idx(7, 0)] === 'r') {
        if (!inCheck(board, 'b') && !isAttacked(board, idx(5, 0), 'w') && !isAttacked(board, idx(6, 0), 'w')) {
          moves.push({ from: idx(4, 0), to: idx(6, 0) });
        }
      }
      if (turn === 'b' && state.castling.q && board[idx(3, 0)] === '' && board[idx(2, 0)] === '' && board[idx(1, 0)] === '' && board[idx(0, 0)] === 'r') {
        if (!inCheck(board, 'b') && !isAttacked(board, idx(3, 0), 'w') && !isAttacked(board, idx(2, 0), 'w')) {
          moves.push({ from: idx(4, 0), to: idx(2, 0) });
        }
      }
    } else {
      const dirs: Record<string, [number, number][]> = {
        r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
        b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
        q: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
      };
      for (const [df, dr] of dirs[type]) {
        let cf = f + df;
        let cr = r + dr;
        while (inBounds(cf, cr)) {
          const t = board[idx(cf, cr)];
          if (t === '') {
            moves.push({ from: sq, to: idx(cf, cr) });
          } else {
            if (colorOf(t) !== turn) moves.push({ from: sq, to: idx(cf, cr) });
            break;
          }
          cf += df;
          cr += dr;
        }
      }
    }
  }
  return moves;
}

function applyMoveUnchecked(state: ChessState, move: Move): ChessState {
  const board = state.board.slice();
  const piece = board[move.from];
  const captured = board[move.to] !== '' ? board[move.to] : undefined;
  board[move.to] = piece;
  board[move.from] = '';

  const newCastling = { ...state.castling };
  const type = piece.toLowerCase();
  const color = state.turn;
  if (type === 'k') {
    if (color === 'w') {
      newCastling.K = false;
      newCastling.Q = false;
    } else {
      newCastling.k = false;
      newCastling.q = false;
    }
    if (Math.abs(move.to - move.from) === 2) {
      if (move.to === idx(6, color === 'w' ? 7 : 0)) {
        board[idx(5, color === 'w' ? 7 : 0)] = board[idx(7, color === 'w' ? 7 : 0)];
        board[idx(7, color === 'w' ? 7 : 0)] = '';
      } else if (move.to === idx(2, color === 'w' ? 7 : 0)) {
        board[idx(3, color === 'w' ? 7 : 0)] = board[idx(0, color === 'w' ? 7 : 0)];
        board[idx(0, color === 'w' ? 7 : 0)] = '';
      }
    }
  }
  if (type === 'r') {
    if (move.from === 63) newCastling.K = false;
    if (move.from === 56) newCastling.Q = false;
    if (move.from === 7) newCastling.k = false;
    if (move.from === 0) newCastling.q = false;
  }
  // rook captured on corner
  if (move.to === 63) newCastling.K = false;
  if (move.to === 56) newCastling.Q = false;
  if (move.to === 7) newCastling.k = false;
  if (move.to === 0) newCastling.q = false;

  let ep: number | null = null;
  if (type === 'p') {
    if (Math.abs(move.to - move.from) === 16) {
      ep = (move.from + move.to) / 2;
    }
    // en passant capture
    if (state.ep === move.to && captured === undefined) {
      const capSq = move.to + (state.turn === 'w' ? 8 : -8);
      board[capSq] = '';
    }
    if (move.promotion) board[move.to] = move.promotion;
  }

  const isCapture = captured !== undefined || (type === 'p' && state.ep === move.to);
  const halfmove = isCapture || type === 'p' ? 0 : state.halfmove + 1;
  const fullmove = state.turn === 'b' ? state.fullmove + 1 : state.fullmove;
  const turn: Color = state.turn === 'w' ? 'b' : 'w';
  return {
    ...state,
    board,
    turn,
    castling: newCastling,
    ep,
    halfmove,
    fullmove,
  };
}

function positionKey(state: ChessState): string {
  return state.board.join('') + state.turn + (state.castling.K ? 'K' : '') + (state.castling.Q ? 'Q' : '') + (state.castling.k ? 'k' : '') + (state.castling.q ? 'q' : '') + (state.ep !== null ? squareName(state.ep) : '-');
}

export function getLegalMoves(state: ChessState): Move[] {
  return pseudoMoves(state).filter((m) => {
    const after = applyMoveUnchecked(state, m);
    return !inCheck(after.board, state.turn);
  });
}

export function chessStatus(state: ChessState): ChessState {
  if (state.status === 'finished') return state;
  const legal = getLegalMoves(state);
  if (legal.length === 0) {
    if (inCheck(state.board, state.turn)) {
      const winner = state.playerIds[state.turn === 'w' ? 1 : 0];
      return { ...state, status: 'finished', result: { winner, reason: 'checkmate' } };
    }
    return { ...state, status: 'finished', result: { winner: null, reason: 'stalemate' } };
  }
  return state;
}

function insufficientMaterial(board: Board): boolean {
  const pieces = board.filter((p) => p !== '' && p.toLowerCase() !== 'k');
  if (pieces.length === 0) return true;
  if (pieces.length === 1 && (pieces[0].toLowerCase() === 'b' || pieces[0].toLowerCase() === 'n')) return true;
  return false;
}

export interface ChessOutcome {
  state: ChessState;
  events: GameEvent[];
  finished: boolean;
  winner: string | null;
}

export function applyChessMove(state: ChessState, move: Move, playerId?: string): ChessOutcome {
  if (state.status === 'finished') {
    return { state, events: [], finished: true, winner: state.result?.winner ?? null };
  }
  const expectedPlayer = state.playerIds[state.turn === 'w' ? 0 : 1];
  if (playerId && expectedPlayer && playerId !== expectedPlayer) {
    throw new Error('not_your_turn');
  }
  const legal = getLegalMoves(state);
  const found = legal.find(
    (m) =>
      m.from === move.from &&
      m.to === move.to &&
      (move.promotion ? m.promotion === move.promotion : true)
  );
  if (!found) throw new Error('illegal_move');

  const captured = state.board[move.to] !== '' ? (state.board[move.to] as Piece) : undefined;
  let next = applyMoveUnchecked(state, found);
  next.history = [
    ...state.history,
    { move: found, captured, key: positionKey(state) },
  ];

  const events: GameEvent[] = [{ type: 'move', data: { from: move.from, to: move.to, promotion: found.promotion } }];

  // threefold repetition
  const counts = new Map<string, number>();
  for (const h of next.history) counts.set(h.key, (counts.get(h.key) || 0) + 1);
  let finished = false;
  let winner: string | null = null;
  let result: ChessState['result'];

  if (getLegalMoves(next).length === 0) {
    if (inCheck(next.board, next.turn)) {
      winner = state.playerIds[state.turn === 'w' ? 0 : 1];
      result = { winner, reason: 'checkmate' };
      events.push({ type: 'checkmate', data: { winner } });
    } else {
      result = { winner: null, reason: 'stalemate' };
      events.push({ type: 'stalemate' });
    }
    finished = true;
  } else if (next.halfmove >= 100) {
    result = { winner: null, reason: 'fifty_moves' };
    events.push({ type: 'draw', data: { reason: 'fifty_moves' } });
    finished = true;
  } else if (insufficientMaterial(next.board)) {
    result = { winner: null, reason: 'insufficient_material' };
    events.push({ type: 'draw', data: { reason: 'insufficient_material' } });
    finished = true;
  } else if ([...counts.values()].some((c) => c >= 3)) {
    result = { winner: null, reason: 'repetition' };
    events.push({ type: 'draw', data: { reason: 'repetition' } });
    finished = true;
  } else if (inCheck(next.board, next.turn)) {
    events.push({ type: 'check' });
  }

  next.status = finished ? 'finished' : 'playing';
  next.result = result;

  return { state: next, events, finished, winner };
}

export function chessNotation(state: ChessState, move: Move): string {
  const piece = state.board[move.from];
  const type = piece.toLowerCase();
  const captured = state.board[move.to] !== '' || (state.board[move.from].toLowerCase() === 'p' && state.ep === move.to);
  let str = '';
  if (type === 'k' && Math.abs(move.to - move.from) === 2) {
    return move.to > move.from ? 'O-O' : 'O-O-O';
  }
  if (type !== 'p') str += piece.toUpperCase();
  if (type === 'p' && captured) str += FILES[move.from % 8];
  if (captured) str += 'x';
  str += squareName(move.to);
  if (move.promotion) str += '=' + move.promotion.toUpperCase();
  return str;
}

export const chessMeta = {
  id: 'chess',
  name: '7G Chess',
  minPlayers: 2,
  maxPlayers: 2,
  solo: true,
  local: true,
  online: true,
  durationMin: 15,
};
