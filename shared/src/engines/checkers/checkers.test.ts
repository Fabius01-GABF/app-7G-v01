import { describe, it, expect } from 'vitest';
import { createCheckersState, applyCheckersMove, getCheckersMoves, type Cell } from './checkers';

const fresh = () => createCheckersState({ playerIds: ['a', 'b'] });

function setBoard(state: ReturnType<typeof fresh>, cells: Record<number, Cell>) {
  for (const [i, c] of Object.entries(cells)) state.board[Number(i)] = c;
  return state;
}

describe('7G Checkers', () => {
  it('starts with 12 pieces each and black moves first', () => {
    const s = fresh();
    expect(s.board.filter((c) => c === 'b').length).toBe(12);
    expect(s.board.filter((c) => c === 'w').length).toBe(12);
    expect(s.turn).toBe(0);
  });

  it('forces a capture when available', () => {
    let s = fresh();
    s.board.fill('');
    setBoard(s, { 43: 'b', 36: 'w' }); // black at (3,5), white at (4,4), landing (5,3) empty
    const moves = getCheckersMoves(s, 'a');
    expect(moves).toEqual([{ from: 43, to: 29 }]);
  });

  it('continues a capture chain', () => {
    let s = fresh();
    s.board.fill('');
    setBoard(s, { 43: 'b', 36: 'w', 22: 'w' }); // landing 29, then 15
    const first = getCheckersMoves(s, 'a');
    expect(first).toEqual([{ from: 43, to: 29 }]);
    const s1 = applyCheckersMove(s, first[0], 'a').state;
    expect(s1.turn).toBe(0); // same player continues
    const second = getCheckersMoves(s1, 'a');
    expect(second).toEqual([{ from: 29, to: 15 }]);
    const out = applyCheckersMove(s1, second[0], 'a');
    expect(out.state.board[22]).toBe('');
    expect(out.state.board[15]).toBe('b');
    expect(out.state.turn).toBe(1);
  });

  it('promotes a man reaching the last row and ends the turn', () => {
    let s = fresh();
    s.board.fill('');
    setBoard(s, { 22: 'b', 13: 'w' }); // black at (2,6), white at (1,5), landing (0,4)
    const moves = getCheckersMoves(s, 'a');
    expect(moves).toEqual([{ from: 22, to: 4 }]);
    const out = applyCheckersMove(s, { from: 22, to: 4 }, 'a');
    expect(out.state.board[4]).toBe('B');
    expect(out.state.turn).toBe(1);
  });

  it('detects the win when the opponent has no pieces', () => {
    let s = fresh();
    s.board.fill('');
    setBoard(s, { 60: 'b', 53: 'w', 46: '' }); // black captures last white man
    const out = applyCheckersMove(s, { from: 60, to: 46 }, 'a');
    expect(out.state.status).toBe('finished');
    expect(out.winner).toBe('a');
  });

  it('rejects an illegal non-capture when a capture exists', () => {
    let s = fresh();
    s.board.fill('');
    setBoard(s, { 43: 'b', 36: 'w', 42: '' }); // 43 can capture 36 or move to 34
    const moves = getCheckersMoves(s, 'a');
    expect(moves.some((m) => m.from === 43 && m.to === 34)).toBe(false);
  });
});
