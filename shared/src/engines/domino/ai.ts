import { DominoState, DominoAction, getDominoActions, DOMINO_TILES } from './domino';

export function chooseDominoAction(state: DominoState, difficulty: 'easy' | 'medium' | 'hard', rng: () => number = Math.random, aiPlayer?: string): DominoAction | null {
  const pid = aiPlayer ?? state.playerIds[state.turn];
  const actions = getDominoActions(state, pid);
  if (actions.length === 0) return null;
  if (difficulty === 'easy') {
    return actions[Math.floor(rng() * actions.length)];
  }
  const plays = actions.filter((a) => a.type === 'play');
  if (plays.length === 0) return actions[0];
  const hand = state.hands[state.turn];
  const sumAfter = (tile: number) => hand.reduce((s, t) => (t === tile ? s : s + DOMINO_TILES[t].a + DOMINO_TILES[t].b), 0);
  const ranked = plays.slice().sort((x, y) => {
    const sa = sumAfter(x.tile);
    const sb = sumAfter(y.tile);
    if (difficulty === 'hard') return sa - sb;
    const da = DOMINO_TILES[x.tile].a === DOMINO_TILES[x.tile].b ? 1 : 0;
    const db = DOMINO_TILES[y.tile].a === DOMINO_TILES[y.tile].b ? 1 : 0;
    return (sb - sa) || (da - db);
  });
  return ranked[0];
}
