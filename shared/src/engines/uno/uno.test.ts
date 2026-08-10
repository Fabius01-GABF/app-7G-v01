import { describe, it, expect } from 'vitest';
import { createUnoState, applyUnoAction, getUnoActions, UnoState, UnoColor } from './uno';
import { chooseUnoAction } from './ai';

function st(over: Partial<UnoState>): UnoState {
  return {
    playerIds: ['a', 'b', 'c'],
    hands: [[{ color: 'r' as UnoColor, value: 5 }], [{ color: 'r' as UnoColor, value: 1 }], [{ color: 'b' as UnoColor, value: 2 }]],
    drawPile: [{ color: 'b' as UnoColor, value: 9 }, { color: 'g' as UnoColor, value: 4 }],
    discard: [{ color: 'r' as UnoColor, value: 3 }],
    currentColor: 'r' as UnoColor,
    turn: 0,
    direction: 1,
    status: 'playing',
    eventLog: [],
    pendingDraw: 0,
    ...over,
  };
}

describe('7G UNO', () => {
  it('deals 7 cards each with a non-wild top discard', () => {
    const s = createUnoState({ playerIds: ['a', 'b'] });
    expect(s.hands.length).toBe(2);
    expect(s.hands[0].length).toBe(7);
    expect(s.hands[1].length).toBe(7);
    expect(s.discard[s.discard.length - 1].color).not.toBeNull();
  });

  it('wins by emptying the hand on a matching play', () => {
    const s = st({ hands: [[{ color: 'r', value: 5 }], [{ color: 'r', value: 1 }], [{ color: 'b', value: 2 }]] }); // single card, matches color
    const out = applyUnoAction(s, { type: 'play', card: 0 }, 'a');
    expect(out.state.status).toBe('finished');
    expect(out.state.result?.winner).toBe('a');
  });

  it('plays a card of the same value with a different color', () => {
    const s = st({ hands: [[{ color: 'b', value: 3 }, { color: 'r', value: 7 }]] }); // value matches top (3)
    const out = applyUnoAction(s, { type: 'play', card: 0 }, 'a');
    expect(out.state.currentColor).toBe('b');
    expect(out.state.turn).toBe(1);
    expect(out.state.status).toBe('playing');
  });

  it('applies skip', () => {
    const s = st({ hands: [[{ color: 'r', value: 'skip' }, { color: 'b', value: 5 }]] });
    const out = applyUnoAction(s, { type: 'play', card: 0 }, 'a');
    expect(out.state.turn).toBe(2); // 3 players -> skipped player b
  });

  it('applies reverse with 3 players', () => {
    const s = st({ hands: [[{ color: 'r', value: 'reverse' }, { color: 'b', value: 5 }]] });
    const out = applyUnoAction(s, { type: 'play', card: 0 }, 'a');
    expect(out.state.direction).toBe(-1);
    expect(out.state.turn).toBe(2);
  });

  it('applies reverse as a skip with 2 players', () => {
    const s = st({ playerIds: ['a', 'b'], hands: [[{ color: 'r', value: 'reverse' }, { color: 'b', value: 1 }], [{ color: 'b', value: 1 }]] });
    const out = applyUnoAction(s, { type: 'play', card: 0 }, 'a');
    expect(out.state.turn).toBe(0);
  });

  it('applies wild +4 and the next player draws 4', () => {
    const s = st({
      hands: [[{ color: null, value: 'wild4' }, { color: 'r', value: 1 }], [{ color: 'r', value: 1 }], [{ color: 'b', value: 2 }]],
      drawPile: [{ color: 'b', value: 9 }, { color: 'g', value: 4 }, { color: 'r', value: 6 }, { color: 'y', value: 2 }],
    });
    const out = applyUnoAction(s, { type: 'play', card: 0, color: 'g' }, 'a');
    expect(out.state.currentColor).toBe('g');
    expect(out.state.turn).toBe(2);
    expect(out.state.hands[2].length).toBe(1 + 4);
  });

  it('draws when nothing is playable, then advances the turn', () => {
    const s = st({ hands: [[{ color: 'b', value: 9 }]] }); // nothing matches r/3
    expect(getUnoActions(s, 'a')).toEqual([{ type: 'draw' }]);
    const out = applyUnoAction(s, { type: 'draw' }, 'a');
    expect(out.state.hands[0].length).toBe(2);
    expect(out.state.turn).toBe(1);
  });

  it('rejects an illegal play', () => {
    const s = st({ hands: [[{ color: 'b', value: 9 }]] });
    expect(() => applyUnoAction(s, { type: 'play', card: 0 }, 'a')).toThrow('illegal_move');
  });

  it('rejects a move out of turn', () => {
    const s = st({});
    expect(() => applyUnoAction(s, { type: 'play', card: 0 }, 'b')).toThrow('not_your_turn');
  });

  it('AI hard plays a color card without adding a color field (regression)', () => {
    const s = st({ hands: [[{ color: 'r', value: 5 }, { color: 'y', value: 2 }], [{ color: 'b', value: 1 }], [{ color: 'b', value: 2 }]] });
    const action = chooseUnoAction(s, 'hard', () => 0.5, 'a');
    expect(action).not.toBeNull();
    expect(action!.type).toBe('play');
    if (action!.type === 'play') {
      const card = s.hands[0][action!.card];
      if (card.color !== null) {
        expect(action!.color).toBeUndefined();
      }
      const out = applyUnoAction(s, action as never, 'a');
      expect(out.state.status).toBe('playing');
    }
  });
});
