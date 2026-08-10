import { describe, it, expect } from 'vitest';
import { createLudoState, applyLudoAction, getLudoActions, ringPos } from './ludo';

const fresh = () => createLudoState({ playerIds: ['a', 'b', 'c'] });

const rngSix = () => (6 - 1) / 6;
const rngTwo = () => (2 - 1) / 6;

describe('7G Ludo', () => {
  it('requires a 6 to leave the base', () => {
    let s = fresh();
    expect(getLudoActions(s, 'a')).toEqual([{ type: 'roll' }]);
    const r1 = applyLudoAction(s, { type: 'roll' }, 'a', rngTwo);
    expect(r1.state.dice).toBe(2);
    // no movable pawns -> turn auto-advances, still in roll phase
    expect(r1.state.phase).toBe('roll');
    expect(r1.state.turn).toBe(1);
    expect(r1.state.pawns.every((p) => p === -1)).toBe(true);
  });

  it('exits a pawn on a 6 and rolls again', () => {
    let s = fresh();
    const r1 = applyLudoAction(s, { type: 'roll' }, 'a', rngSix);
    expect(r1.state.dice).toBe(6);
    const acts = getLudoActions(r1.state, 'a');
    expect(acts.filter((a) => a.type === 'move').length).toBe(4);
    const r2 = applyLudoAction(r1.state, { type: 'move', pawn: 0 }, 'a');
    expect(r2.state.pawns[0]).toBe(0);
    expect(r2.state.turn).toBe(0); // 6 = extra turn
  });

  it('captures an opponent on the same ring square', () => {
    let s = fresh();
    // player a pawn at journey 3 (ring 3), player b pawn at ring 5 (journey 5 for b? ringPos(b=1,5)=18)
    // place player a pawn journey 3, player b pawn journey such that ringPos(1,j)=5 -> j=5 gives 18. Need ring 5: (13+j)%52=5 -> j=5? no.
    // ring 5 for player 1: (13 + j) % 52 = 5 -> j = 5 - 13 mod 52 = 44
    s.pawns[0] = 3;
    s.pawns[4] = 44; // player 1 pawn at ring 5
    s.turn = 0;
    const r1 = applyLudoAction(s, { type: 'roll' }, 'a', rngTwo);
    expect(r1.state.dice).toBe(2);
    const r2 = applyLudoAction(r1.state, { type: 'move', pawn: 0 }, 'a');
    expect(r2.state.pawns[0]).toBe(5);
    expect(ringPos(0, 5)).toBe(5);
    expect(r2.state.pawns[4]).toBe(-1); // captured back to base
  });

  it('does not capture on a safe square', () => {
    let s = fresh();
    // player a pawn at journey 4 -> will land on journey 8 (ring 8 = star of player 0, safe)
    // player b pawn at ring 8 too: for player 1, (13+j)%52=8 -> j=47
    s.pawns[0] = 4;
    s.pawns[4] = 47;
    s.turn = 0;
    const r1 = applyLudoAction(s, { type: 'roll' }, 'a', () => 0.5); // dice 4
    expect(r1.state.dice).toBe(4);
    const r2 = applyLudoAction(r1.state, { type: 'move', pawn: 0 }, 'a');
    expect(r2.state.pawns[0]).toBe(8);
    expect(r2.state.pawns[4]).toBe(47); // not captured on safe square
  });

  it('rejects a move that overshoots home', () => {
    let s = fresh();
    s.pawns[0] = 55; // one step before home
    s.turn = 0;
    s.dice = 6;
    s.phase = 'move';
    expect(() => applyLudoAction(s, { type: 'move', pawn: 0 }, 'a')).toThrow('illegal_move');
  });

  it('wins when all four pawns reach home', () => {
    let s = fresh();
    s.pawns = [56, 56, 56, 55, -1, -1, -1, -1, -1, -1, -1, -1];
    s.turn = 0;
    s.dice = 1;
    s.phase = 'move';
    const out = applyLudoAction(s, { type: 'move', pawn: 3 }, 'a');
    expect(out.state.status).toBe('finished');
    expect(out.state.result?.winner).toBe('a');
  });

  it('moves a player-b pawn with the absolute pawn index (regression)', () => {
    let s = fresh();
    // player a rolls a 2 (no movable pawn) -> auto-advance to player b
    const r0 = applyLudoAction(s, { type: 'roll' }, 'a', rngTwo);
    expect(r0.state.turn).toBe(1);
    // player b (turn 1): pawn index 4 rolls a 6, then moves to journey 0
    const r1 = applyLudoAction(r0.state, { type: 'roll' }, 'b', rngSix);
    expect(r1.state.turn).toBe(1);
    expect(r1.state.dice).toBe(6);
    const acts = getLudoActions(r1.state, 'b');
    expect(acts.some((a) => a.type === 'move' && a.pawn === 4)).toBe(true);
    const r2 = applyLudoAction(r1.state, { type: 'move', pawn: 4 }, 'b');
    expect(r2.state.pawns[4]).toBe(0);
    expect(r2.state.turn).toBe(1); // 6 = extra turn
  });
});
