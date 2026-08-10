import { UnoState, UnoAction, UnoAnyAction, getUnoActions, UNO_COLORS } from './uno';

export function chooseUnoAction(state: UnoState, difficulty: 'easy' | 'medium' | 'hard', rng: () => number = Math.random, aiPlayer?: string): UnoAnyAction {
  const pid = aiPlayer ?? state.playerIds[state.turn];
  const actions = getUnoActions(state, pid);
  if (actions.length === 0) return { type: 'draw' };
  if (actions.length === 1) return actions[0];

  if (difficulty === 'easy') {
    return actions[Math.floor(rng() * actions.length)];
  }

  const hand = state.hands[state.turn];
  const colorCount: Record<string, number> = { r: 0, y: 0, g: 0, b: 0 };
  for (const c of hand) if (c.color) colorCount[c.color]++;
  const bestColor = UNO_COLORS.slice().sort((a, b) => colorCount[b] - colorCount[a])[0];

  const playable = actions.filter((a): a is UnoAction => a.type === 'play');
  const ranked = playable.slice().sort((a, b) => {
    const av = hand[a.card].value;
    const bv = hand[b.card].value;
    const scoreA = typeof av === 'number' ? av : av === 'wild' ? 1 : av === 'wild4' ? 0 : 15;
    const scoreB = typeof bv === 'number' ? bv : bv === 'wild' ? 1 : bv === 'wild4' ? 0 : 15;
    return scoreB - scoreA;
  });

  const pick = (chosen: UnoAction): UnoAction => {
    if (hand[chosen.card].color === null) return { ...chosen, color: bestColor };
    return chosen;
  };

  if (difficulty === 'medium') return pick(ranked[0]);

  // hard: keep wilds if possible
  const nonWild = ranked.filter((a) => hand[a.card].color !== null);
  if (nonWild.length > 0) return pick(nonWild[0]);
  return pick(ranked[0]);
}
