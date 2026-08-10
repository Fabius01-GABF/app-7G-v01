import { CheckersState, CheckersMove, getCheckersMoves, applyCheckersMove, colorOf, isKing } from './checkers';

function evaluate(state: CheckersState): number {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const c = state.board[i];
    if (c === '') continue;
    const col = colorOf(c)!;
    const sign = col === 0 ? 1 : -1;
    const base = isKing(c) ? 300 : 100;
    const r = Math.floor(i / 8);
    const adv = col === 0 ? 7 - r : r;
    score += sign * (base + adv * 2);
  }
  return score;
}

interface SearchResult {
  score: number;
  move: CheckersMove | null;
}

function search(state: CheckersState, depth: number, alpha: number, beta: number, maximizing: boolean): SearchResult {
  const moves = getCheckersMoves(state, undefined);
  if (moves.length === 0) return { score: maximizing ? -100000 : 100000, move: null };
  if (depth === 0) return { score: evaluate(state), move: null };

  let best: SearchResult = maximizing ? { score: -Infinity, move: null } : { score: Infinity, move: null };
  // prefer captures first (order by capture)
  const ordered = moves.slice().sort((a, b) => {
    const ac = Math.abs(Math.floor(a.to / 8) - Math.floor(a.from / 8)) === 2 ? 1 : 0;
    const bc = Math.abs(Math.floor(b.to / 8) - Math.floor(b.from / 8)) === 2 ? 1 : 0;
    return bc - ac;
  });
  for (const m of ordered) {
    const out = applyCheckersMove(state, m);
    const child = search(out.state, depth - 1, alpha, beta, !maximizing);
    if (maximizing) {
      if (child.score > best.score) best = { score: child.score, move: m };
      alpha = Math.max(alpha, best.score);
    } else {
      if (child.score < best.score) best = { score: child.score, move: m };
      beta = Math.min(beta, best.score);
    }
    if (beta <= alpha) break;
  }
  return best;
}

export function chooseCheckersMove(state: CheckersState, difficulty: 'easy' | 'medium' | 'hard', rng: () => number = Math.random): CheckersMove | null {
  const moves = getCheckersMoves(state, undefined);
  if (moves.length === 0) return null;
  const depth = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 4;
  if (difficulty === 'easy' && rng() < 0.25) return moves[Math.floor(rng() * moves.length)];
  const maximizing = state.turn === 0;
  const res = search(state, depth, -Infinity, Infinity, maximizing);
  return res.move;
}
