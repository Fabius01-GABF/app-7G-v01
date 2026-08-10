import { describe, it, expect } from 'vitest';
import { createChessState, applyChessMove, getLegalMoves, chessStatus, parseSquare } from './chess';
import { chooseChessMove } from './ai';

const P2 = () => createChessState({ playerIds: ['a', 'b'] });

describe('7G Chess', () => {
  it('rejects a move out of turn', () => {
    const s = P2();
    expect(() => applyChessMove(s, { from: parseSquare('e7'), to: parseSquare('e5') }, 'b')).toThrow('not_your_turn');
  });

  it('allows opening e2-e4 and e7-e5', () => {
    let s = P2();
    s = applyChessMove(s, { from: parseSquare('e2'), to: parseSquare('e4') }, 'a').state;
    s = applyChessMove(s, { from: parseSquare('e7'), to: parseSquare('e5') }, 'b').state;
    expect(s.board[parseSquare('e4')]).toBe('P');
    expect(s.board[parseSquare('e5')]).toBe('p');
  });

  it('rejects an illegal pawn triple-step', () => {
    let s = P2();
    s = applyChessMove(s, { from: parseSquare('e2'), to: parseSquare('e4') }, 'a').state;
    expect(() => applyChessMove(s, { from: parseSquare('e7'), to: parseSquare('e4') }, 'b')).toThrow('illegal_move');
  });

  it('detects checkmate (Q b7, K c6 vs K a8)', () => {
    const s = createChessState({ playerIds: ['a', 'b'], startFen: 'k7/1Q6/2K5/8/8/8/8/8 b - - 0 1' });
    expect(getLegalMoves(s).length).toBe(0);
    const st = chessStatus(s);
    expect(st.status).toBe('finished');
    expect(st.result?.winner).toBe('a'); // white (playerIds[0]) mates black
    expect(st.result?.reason).toBe('checkmate');
  });

  it('allows castling with rights and no blockers', () => {
    const s = createChessState({ playerIds: ['a', 'b'], startFen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1' });
    const moves = getLegalMoves(s);
    expect(moves.some((m) => m.from === parseSquare('e1') && m.to === parseSquare('g1'))).toBe(true);
    expect(moves.some((m) => m.from === parseSquare('e1') && m.to === parseSquare('c1'))).toBe(true);
    const out = applyChessMove(s, { from: parseSquare('e1'), to: parseSquare('g1') }, 'a');
    expect(out.state.board[parseSquare('g1')]).toBe('K');
    expect(out.state.board[parseSquare('f1')]).toBe('R');
    expect(out.state.castling.K).toBe(false);
    expect(out.state.castling.Q).toBe(false);
  });

  it('does not castle through check', () => {
    const s = createChessState({ playerIds: ['a', 'b'], startFen: '4rkr1/8/8/8/8/8/8/R3K2R w KQkq - 0 1' });
    const moves = getLegalMoves(s);
    expect(moves.some((m) => m.from === parseSquare('e1') && m.to === parseSquare('g1'))).toBe(false);
  });

  it('handles en passant capture', () => {
    const s = createChessState({ playerIds: ['a', 'b'], startFen: '8/8/8/3pP3/8/8/8/8 w - d6 0 1' });
    const moves = getLegalMoves(s);
    expect(moves.some((m) => m.from === parseSquare('e5') && m.to === parseSquare('d6'))).toBe(true);
    const out = applyChessMove(s, { from: parseSquare('e5'), to: parseSquare('d6') }, 'a');
    expect(out.state.board[parseSquare('d6')]).toBe('P');
    expect(out.state.board[parseSquare('d5')]).toBe('');
  });

  it('promotes a pawn on demand', () => {
    const s = createChessState({ playerIds: ['a', 'b'], startFen: '8/P7/8/8/8/8/8/k6K w - - 0 1' });
    const out = applyChessMove(s, { from: parseSquare('a7'), to: parseSquare('a8'), promotion: 'Q' }, 'a');
    expect(out.state.board[parseSquare('a8')]).toBe('Q');
  });

  it('detects stalemate', () => {
    const s = createChessState({ playerIds: ['a', 'b'], startFen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1' });
    expect(getLegalMoves(s).length).toBe(0);
    const st = chessStatus(s);
    expect(st.status).toBe('finished');
    expect(st.result?.reason).toBe('stalemate');
    expect(st.result?.winner).toBe(null);
  });

  it('draws by insufficient material K vs K', () => {
    const s = createChessState({ playerIds: ['a', 'b'], startFen: '8/8/8/8/8/8/8/K6k w - - 0 1' });
    const legal = getLegalMoves(s);
    const out = applyChessMove(s, legal[0], 'a');
    expect(out.state.status).toBe('finished');
    expect(out.state.result?.reason).toBe('insufficient_material');
    expect(out.winner).toBe(null);
  });

  it('counts all initial legal moves as 20', () => {
    const s = P2();
    expect(getLegalMoves(s).length).toBe(20);
  });

  it('AI returns a playable move at every difficulty (regression)', () => {
    const s = P2();
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const mv = chooseChessMove(s, d, () => 0.5);
      expect(mv).not.toBeNull();
      const legal = getLegalMoves(s);
      expect(legal.some((m) => m.from === mv!.from && m.to === mv!.to)).toBe(true);
      const out = applyChessMove(s, mv!, 'a');
      expect(out.state.turn).toBe('b');
    }
  });
});
