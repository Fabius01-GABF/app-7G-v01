import { CityState, CityAction, getCityActions, CITY_BOARD, houseCost, rentOf } from './city';

export function chooseCityAction(state: CityState, difficulty: 'easy' | 'medium' | 'hard', rng: () => number = Math.random, aiPlayer?: string): CityAction | null {
  const pid = aiPlayer ?? state.playerIds[state.turn];
  const actions = getCityActions(state, pid);
  if (actions.length === 0) return null;

  if (state.phase === 'roll') {
    return { type: 'roll' };
  }
  if (state.phase === 'buy') {
    const sq = CITY_BOARD[state.positions[state.turn]];
    const price = sq.price ?? 0;
    if (difficulty === 'easy') {
      return state.money[state.turn] >= price ? { type: 'buy' } : { type: 'pass' };
    }
    const ratio = state.money[state.turn] / Math.max(1, price);
    const buy = difficulty === 'hard' ? ratio >= 1.5 : ratio >= 4;
    return buy ? { type: 'buy' } : { type: 'pass' };
  }

  // build phase
  const end = actions.find((a) => a.type === 'endTurn')!;
  const builds = actions.filter((a) => a.type === 'build');

  const bestHouse = builds
    .filter((a) => a.op === 'buyHouse')
    .sort((a, b) => {
      const ra = rentOf(CITY_BOARD[a.prop], state.properties[a.prop]);
      const rb = rentOf(CITY_BOARD[b.prop], state.properties[b.prop]);
      return rb - ra;
    });
  const sell = builds.find((a) => a.op === 'sellHouse');
  const unmortgage = builds.find((a) => a.op === 'unmortgage');
  const mortgage = builds.find((a) => a.op === 'mortgage');

  if (difficulty === 'easy') {
    if (bestHouse.length > 0 && rng() < 0.5) return bestHouse[0];
    if (unmortgage && state.money[state.turn] > 400) return unmortgage;
    return end;
  }
  if (difficulty === 'medium') {
    if (bestHouse.length > 0) return bestHouse[0];
    if (unmortgage && state.money[state.turn] > 800) return unmortgage;
    return end;
  }
  // hard
  if (mortgage && state.money[state.turn] < 100) return mortgage;
  if (sell && state.money[state.turn] < 80) return sell;
  if (bestHouse.length > 0 && state.money[state.turn] - houseCost(CITY_BOARD[bestHouse[0].prop]) >= 150) return bestHouse[0];
  if (unmortgage && state.money[state.turn] > 1000) return unmortgage;
  return end;
}
