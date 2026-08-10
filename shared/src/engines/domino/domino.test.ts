import { describe, it, expect } from 'vitest';
import { createDominoState, applyDominoAction, getDominoActions, DOMINO_TILES, DominoState } from './domino';

const idx = (a: number, b: number) => DOMINO_TILES.findIndex((t) => t.a === a && t.b === b);

function base(): DominoState {
  return {
    playerIds: ['a', 'b'],
    hands: [[], []],
    boneyard: [0, 1, 2, 3, 4, 5, 6],
    chain: [{ a: 4, b: 4 }],
    leftEnd: 4,
    rightEnd: 4,
    turn: 0,
    scores: [0, 0],
    round: 1,
    passed: 0,
    status: 'playing',
    eventLog: [],
  };
}

describe('7G Domino', () => {
  it('deals 7 tiles each and opens the chain with a starter', () => {
    const s = createDominoState({ playerIds: ['a', 'b'] });
    expect(s.hands.length).toBe(2);
    // 13 in hands (14 dealt minus the starter's opening tile), 14 in the boneyard
    expect(s.hands[0].length + s.hands[1].length).toBe(13);
    expect(s.boneyard.length).toBe(28 - 14);
    expect(s.chain.length).toBe(1);
    expect(s.eventLog.some((e) => e.type === 'start')).toBe(true);
  });

  it('plays a tile matching the right end', () => {
    const s = base();
    s.hands[0] = [idx(1, 4), idx(5, 5)];
    const out = applyDominoAction(s, { type: 'play', tile: idx(1, 4), end: 'right' }, 'a');
    expect(out.state.chain.length).toBe(2);
    expect(out.state.rightEnd).toBe(1);
    expect(out.state.hands[0]).toEqual([idx(5, 5)]);
    expect(out.state.turn).toBe(1);
  });

  it('rejects an illegal play', () => {
    const s = base();
    s.hands[0] = [idx(6, 6)];
    expect(() => applyDominoAction(s, { type: 'play', tile: idx(6, 6), end: 'right' }, 'a')).toThrow('illegal_move');
  });

  it('draws from the boneyard when nothing matches', () => {
    const s = base();
    s.hands[0] = [idx(6, 6)];
    expect(getDominoActions(s, 'a')).toEqual([{ type: 'draw' }]);
    const out = applyDominoAction(s, { type: 'draw' }, 'a');
    expect(out.state.hands[0].length).toBe(2);
    expect(out.state.boneyard.length).toBe(6);
    expect(out.state.turn).toBe(0);
  });

  it('passes when blocked and the boneyard is empty, ending the round', () => {
    const s = base();
    s.hands[0] = [idx(6, 6)];
    s.hands[1] = [];
    s.boneyard = [];
    expect(getDominoActions(s, 'a')).toEqual([{ type: 'pass' }]);
    const out = applyDominoAction(s, { type: 'pass' }, 'a');
    // round blocked -> min sum (player b, 0) wins 12 points, next round
    expect(out.state.round).toBe(2);
    expect(out.state.scores[1]).toBe(12);
  });

  it('wins when the hand empties and the score reaches 100', () => {
    const s = base();
    s.hands[0] = [idx(1, 4)];
    s.hands[1] = [idx(5, 5)];
    s.scores = [95, 0];
    const out = applyDominoAction(s, { type: 'play', tile: idx(1, 4), end: 'right' }, 'a');
    expect(out.state.status).toBe('finished');
    expect(out.state.result?.winner).toBe('a');
    expect(out.state.result?.finalScores[0]).toBe(105); // 95 + 10 from opponent
  });
});
