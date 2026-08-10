import { ChessState, Move, getLegalMoves, applyChessMove, PIECE_VALUES, colorOf, inCheck } from './chess';

type Eval = number;

const PST_PAWN = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5, 5, 10, 25, 25, 10, 5, 5,
  0, 0, 0, 20, 20, 0, 0, 0,
  5, -5, -10, 0, 0, -10, -5, 5,
  5, 10, 10, -20, -20, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
];
const PST_KNIGHT = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];
const PST_BISHOP = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10,
  -10, 0, 10, 10, 10, 10, 0, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 5, 0, 0, 0, 0, 5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
];
const PST_ROOK = [
  0, 0, 0, 0, 0, 0, 0, 0,
  5, 10, 10, 10, 10, 10, 10, 5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  0, 0, 0, 5, 5, 0, 0, 0,
];
const PST_QUEEN = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 5, 5, 5, 0, -10,
  -5, 0, 5, 5, 5, 5, 0, -5,
  0, 0, 5, 5, 5, 5, 0, -5,
  -10, 5, 5, 5, 5, 5, 0, -10,
  -10, 0, 5, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
];
const PST_KING = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  20, 20, 0, 0, 0, 0, 20, 20,
  20, 30, 10, 0, 0, 10, 30, 20,
];

function evaluate(state: ChessState): Eval {
  let score = 0;
  const board = state.board;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p === '') continue;
    const white = p === p.toUpperCase();
    const type = p.toLowerCase();
    const sign = white ? 1 : -1;
    let table = PST_PAWN;
    if (type === 'n') table = PST_KNIGHT;
    else if (type === 'b') table = PST_BISHOP;
    else if (type === 'r') table = PST_ROOK;
    else if (type === 'q') table = PST_QUEEN;
    else if (type === 'k') table = PST_KING;
    const sq = white ? i : 63 - i;
    score += sign * (PIECE_VALUES[type.toUpperCase()] * 100 + table[sq]);
  }
  return score;
}

interface SearchResult {
  score: Eval;
  move: Move | null;
}

function orderMoves(state: ChessState, moves: Move[]): Move[] {
  return moves
    .map((m) => {
      let score = 0;
      const captured = state.board[m.to];
      if (captured !== '') score += 10 * PIECE_VALUES[captured.toLowerCase()] - PIECE_VALUES[state.board[m.from].toLowerCase()];
      if (m.promotion) score += 900;
      return { m, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.m);
}

function minimax(state: ChessState, depth: number, alpha: number, beta: number, maximizing: boolean, rng: () => number, noise: number): SearchResult {
  const moves = getLegalMoves(state);
  if (moves.length === 0) {
    const inChk = inCheck(state.board, state.turn);
    const base = inChk ? -100000 : 0;
    return { score: base + depth * 50, move: null };
  }
  if (depth === 0) return { score: evaluate(state), move: null };

  const ordered = orderMoves(state, moves);
  let best: SearchResult = maximizing ? { score: -Infinity, move: null } : { score: Infinity, move: null };

  for (const m of ordered) {
    const out = applyChessMove(state, m);
    const child = minimax(out.state, depth - 1, alpha, beta, !maximizing, rng, noise);
    if (maximizing) {
      if (child.score > best.score) best = { score: child.score, move: m };
      alpha = Math.max(alpha, best.score);
    } else {
      if (child.score < best.score) best = { score: child.score, move: m };
      beta = Math.min(beta, best.score);
    }
    if (beta <= alpha) break;
  }
  if (noise > 0 && best.move) {
    best = { ...best, score: best.score + (rng() - 0.5) * noise };
  }
  return best;
}

export function chooseChessMove(state: ChessState, difficulty: 'easy' | 'medium' | 'hard', rng: () => number = Math.random): Move | null {
  const depth = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 2;
  const noise = difficulty === 'easy' ? 60 : difficulty === 'medium' ? 20 : 0;
  const maximizing = state.turn === 'w';
  const res = minimax(state, depth, -Infinity, Infinity, maximizing, rng, noise);
  return res.move;
}
