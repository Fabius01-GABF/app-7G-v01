import { GameStatus, GameEvent } from '../../core/types';
import { shuffle } from '../../core/rng';

export interface CitySquare {
  index: number;
  name: string;
  type: 'go' | 'property' | 'chance' | 'tax' | 'jail';
  price?: number;
  color?: string;
  tax?: number;
}

export const CITY_BOARD: CitySquare[] = [
  { index: 0, name: 'Départ', type: 'go' },
  { index: 1, name: 'Avenue Alpha', type: 'property', price: 60, color: 'blue' },
  { index: 2, name: 'Rue Béta', type: 'property', price: 60, color: 'blue' },
  { index: 3, name: 'Chance', type: 'chance' },
  { index: 4, name: 'Boulevard Gamma', type: 'property', price: 100, color: 'teal' },
  { index: 5, name: 'Rue Delta', type: 'property', price: 100, color: 'teal' },
  { index: 6, name: 'Impôt', type: 'tax', tax: 100 },
  { index: 7, name: 'Rue Epsilon', type: 'property', price: 120, color: 'teal' },
  { index: 8, name: 'Prison (visite)', type: 'jail' },
  { index: 9, name: 'Avenue Zêta', type: 'property', price: 140, color: 'pink' },
  { index: 10, name: 'Rue Êta', type: 'property', price: 140, color: 'pink' },
  { index: 11, name: 'Avenue Thêta', type: 'property', price: 160, color: 'pink' },
  { index: 12, name: 'Rue Iota', type: 'property', price: 180, color: 'orange' },
  { index: 13, name: 'Chance', type: 'chance' },
  { index: 14, name: 'Avenue Kappa', type: 'property', price: 180, color: 'orange' },
  { index: 15, name: 'Rue Lambda', type: 'property', price: 200, color: 'orange' },
  { index: 16, name: 'Avenue Mu', type: 'property', price: 220, color: 'red' },
  { index: 17, name: 'Rue Nu', type: 'property', price: 220, color: 'red' },
  { index: 18, name: 'Avenue Xi', type: 'property', price: 240, color: 'red' },
  { index: 19, name: 'Grande Taxe', type: 'tax', tax: 150 },
  { index: 20, name: 'Rue Omicron', type: 'property', price: 260, color: 'purple' },
  { index: 21, name: 'Avenue Pi', type: 'property', price: 260, color: 'purple' },
  { index: 22, name: 'Rue Rhô', type: 'property', price: 280, color: 'purple' },
];

export const CITY_SIZE = CITY_BOARD.length;

export interface CityPropertyState {
  owner: number; // -1 none
  houses: number; // 0..4, 5 = hotel
  mortgaged: boolean;
}

export interface CityState {
  playerIds: string[];
  money: number[];
  positions: number[];
  properties: CityPropertyState[];
  chanceDeck: string[];
  turn: number;
  dice: [number, number] | null;
  phase: 'roll' | 'buy' | 'build';
  doubles: number;
  round: number;
  bankrupt: boolean[];
  eliminated: boolean[];
  status: GameStatus;
  result?: { winner: string; rank: string[] };
  eventLog: GameEvent[];
}

export interface CityConfig {
  playerIds: string[];
  seed?: number;
}

export type CityAction =
  | { type: 'roll' }
  | { type: 'buy' }
  | { type: 'pass' }
  | { type: 'build'; prop: number; op: 'buyHouse' | 'sellHouse' | 'mortgage' | 'unmortgage' }
  | { type: 'endTurn' };

const CHANCE_DECK = [
  'collect_50', 'collect_100', 'pay_50', 'pay_100', 'move_go', 'move_3', 'collect_150', 'pay_150',
];
const GO_PAY = 200;
const START_MONEY = 1500;
const MAX_ROUNDS = 60;

export function rentOf(square: CitySquare, prop: CityPropertyState): number {
  const base = Math.max(4, Math.floor((square.price ?? 0) * 0.08));
  if (prop.mortgaged) return 0;
  if (prop.houses === 0) return base;
  const mult = [1, 3, 6, 10, 15, 24][prop.houses];
  return base * mult;
}

export function houseCost(square: CitySquare): number {
  return Math.max(20, Math.floor((square.price ?? 0) * 0.5));
}

function ownedSetCount(state: CityState, owner: number, color: string): number {
  return state.properties.reduce((acc, p, i) => {
    const s = CITY_BOARD[i];
    return acc + (s.type === 'property' && s.color === color && p.owner === owner ? 1 : 0);
  }, 0);
}

export function createCityState(config: CityConfig): CityState {
  const rng = config.seed !== undefined ? seeded(config.seed) : Math.random;
  const n = Math.min(6, Math.max(2, config.playerIds.length));
  const deck = shuffle(CHANCE_DECK, rng);
  return {
    playerIds: config.playerIds.slice(0, n),
    money: new Array(n).fill(START_MONEY),
    positions: new Array(n).fill(0),
    properties: CITY_BOARD.map((s) => ({ owner: -1, houses: 0, mortgaged: false })),
    chanceDeck: deck,
    turn: 0,
    dice: null,
    phase: 'roll',
    doubles: 0,
    round: 1,
    bankrupt: new Array(n).fill(false),
    eliminated: new Array(n).fill(false),
    status: 'playing',
    eventLog: [],
  };
}

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rollDice(rng: () => number): [number, number] {
  return [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
}

function alivePlayers(state: CityState): number[] {
  return state.playerIds.map((_, i) => i).filter((i) => !state.eliminated[i]);
}

export function getCityActions(state: CityState, playerId?: string): CityAction[] {
  if (state.status === 'finished') return [];
  const turn = playerId !== undefined ? state.playerIds.indexOf(playerId) : state.turn;
  if (turn !== state.turn || state.eliminated[turn]) return [];
  if (state.phase === 'roll') return [{ type: 'roll' }];
  if (state.phase === 'buy') {
    const sq = CITY_BOARD[state.positions[turn]];
    const prop = state.properties[sq.index];
    if (prop.owner === -1 && (sq.price ?? 0) <= state.money[turn]) return [{ type: 'buy' }, { type: 'pass' }];
    return [{ type: 'pass' }];
  }
  // build phase
  const actions: CityAction[] = [{ type: 'endTurn' }];
  for (const s of CITY_BOARD) {
    if (s.type !== 'property') continue;
    const p = state.properties[s.index];
    if (p.owner !== turn) continue;
    if (p.mortgaged) {
      if (state.money[turn] >= Math.floor((s.price ?? 0) / 2) * 1.1) actions.push({ type: 'build', prop: s.index, op: 'unmortgage' });
    } else {
      if (p.houses < 5 && state.money[turn] >= houseCost(s) && (p.houses > 0 || ownedSetCount(state, turn, s.color!) === 2)) {
        actions.push({ type: 'build', prop: s.index, op: 'buyHouse' });
      }
      if (p.houses > 0) actions.push({ type: 'build', prop: s.index, op: 'sellHouse' });
      if (p.houses === 0) actions.push({ type: 'build', prop: s.index, op: 'mortgage' });
    }
  }
  return actions;
}

function drawChance(state: CityState, turn: number, events: GameEvent[]): CityState {
  const deck = state.chanceDeck.slice();
  let card = deck.shift()!;
  deck.push(card);
  const money = state.money.slice();
  let position = state.positions[turn];
  let extraPay = 0;
  events.push({ type: 'chance', playerId: state.playerIds[turn], data: { card } });
  if (card === 'collect_50') money[turn] += 50;
  else if (card === 'collect_100') money[turn] += 100;
  else if (card === 'collect_150') money[turn] += 150;
  else if (card === 'pay_50') money[turn] -= 50;
  else if (card === 'pay_100') money[turn] -= 100;
  else if (card === 'pay_150') money[turn] -= 150;
  else if (card === 'move_go') {
    position = 0;
    money[turn] += GO_PAY;
    events.push({ type: 'collect', playerId: state.playerIds[turn], data: { amount: GO_PAY } });
  } else if (card === 'move_3') {
    position = (position + 3) % CITY_SIZE;
  }
  return { ...state, chanceDeck: deck, money, positions: state.positions.map((p, i) => (i === turn ? position : p)) };
}

export function applyCityAction(state: CityState, action: CityAction, playerId?: string, rng: () => number = Math.random): { state: CityState; events: GameEvent[] } {
  if (state.status === 'finished') return { state, events: [] };
  const turn = playerId !== undefined ? state.playerIds.indexOf(playerId) : state.turn;
  if (turn !== state.turn) throw new Error('not_your_turn');
  const events: GameEvent[] = [];
  let s = state;

  if (action.type === 'roll') {
    if (s.phase !== 'roll') throw new Error('invalid_action');
    const dice = rollDice(rng);
    const isDouble = dice[0] === dice[1];
    events.push({ type: 'roll', playerId: s.playerIds[turn], data: { dice } });
    let position = (s.positions[turn] + dice[0] + dice[1]) % CITY_SIZE;
    const crossedGo = s.positions[turn] + dice[0] + dice[1] >= CITY_SIZE;
    const money = s.money.slice();
    if (crossedGo && !(s.positions[turn] === 0)) {
      money[turn] += GO_PAY;
      events.push({ type: 'collect', playerId: s.playerIds[turn], data: { amount: GO_PAY, reason: 'go' } });
    }
    let pos = position;
    let m = money;
    s = { ...s, money: m, positions: s.positions.map((p, i) => (i === turn ? pos : p)) };

    const square = CITY_BOARD[pos];
    if (square.type === 'tax') {
      m[turn] -= square.tax ?? 0;
      events.push({ type: 'tax', playerId: s.playerIds[turn], data: { amount: square.tax } });
      s = { ...s, money: m };
    } else if (square.type === 'chance') {
      s = drawChance({ ...s, money: m }, turn, events);
      if (s.money[turn] <= 0) s = eliminate(s, turn, events);
    } else if (square.type === 'property') {
      const prop = s.properties[pos];
      if (prop.owner === -1) {
        s = { ...s, phase: 'buy', dice };
        return { state: s, events };
      } else if (prop.owner !== turn) {
        const rent = rentOf(square, prop);
        m[turn] -= rent;
        const ownerMoney = s.money.slice();
        ownerMoney[prop.owner] += rent;
        events.push({ type: 'rent', playerId: s.playerIds[turn], data: { amount: rent, to: s.playerIds[prop.owner], prop: square.name } });
        s = { ...s, money: m.map((v, i) => (i === prop.owner ? ownerMoney[i] : v)) };
        if (s.money[turn] <= 0) s = eliminate(s, turn, events);
      }
    }
    // after landing, go to build phase (unless eliminated)
    if (!s.eliminated[turn]) {
      s = { ...s, phase: 'build', dice };
    }
    return { state: s, events };
  }

  if (action.type === 'buy' || action.type === 'pass') {
    if (s.phase !== 'buy') throw new Error('invalid_action');
    const square = CITY_BOARD[s.positions[turn]];
    if (action.type === 'buy') {
      const prop = s.properties[square.index];
      if (prop.owner !== -1) throw new Error('not_available');
      const money = s.money.slice();
      money[turn] -= square.price ?? 0;
      const properties = s.properties.map((p, i) => (i === square.index ? { ...p, owner: turn } : p));
      events.push({ type: 'buy', playerId: s.playerIds[turn], data: { prop: square.name, price: square.price } });
      s = { ...s, money, properties, phase: 'build' };
    } else {
      s = { ...s, phase: 'build' };
    }
    return { state: s, events };
  }

  if (action.type === 'build') {
    if (s.phase !== 'build') throw new Error('invalid_action');
    const prop = s.properties[action.prop];
    const square = CITY_BOARD[action.prop];
    if (prop.owner !== turn) throw new Error('not_owner');
    const money = s.money.slice();
    const properties = s.properties.map((p, i) => (i === action.prop ? { ...p } : p));
    const p = properties[action.prop];
    if (action.op === 'buyHouse') {
      if (p.houses >= 5 || p.mortgaged) throw new Error('cannot_build');
      if (p.houses === 0 && ownedSetCount(s, turn, square.color!) < 2) throw new Error('need_full_set');
      const cost = houseCost(square);
      if (money[turn] < cost) throw new Error('not_enough_money');
      money[turn] -= cost;
      p.houses += 1;
      events.push({ type: 'build', playerId: s.playerIds[turn], data: { prop: square.name, houses: p.houses } });
    } else if (action.op === 'sellHouse') {
      if (p.houses <= 0) throw new Error('no_house');
      money[turn] += houseCost(square);
      p.houses -= 1;
      events.push({ type: 'sell', playerId: s.playerIds[turn], data: { prop: square.name } });
    } else if (action.op === 'mortgage') {
      if (p.mortgaged || p.houses > 0) throw new Error('cannot_mortgage');
      money[turn] += Math.floor((square.price ?? 0) / 2);
      p.mortgaged = true;
      events.push({ type: 'mortgage', playerId: s.playerIds[turn], data: { prop: square.name } });
    } else if (action.op === 'unmortgage') {
      if (!p.mortgaged) throw new Error('not_mortgaged');
      const cost = Math.floor((square.price ?? 0) * 0.55);
      if (money[turn] < cost) throw new Error('not_enough_money');
      money[turn] -= cost;
      p.mortgaged = false;
      events.push({ type: 'unmortgage', playerId: s.playerIds[turn], data: { prop: square.name } });
    }
    s = { ...s, money, properties };
    return { state: s, events };
  }

  // endTurn
  if (s.phase !== 'build') throw new Error('invalid_action');
  const dice = s.dice;
  const isDouble = dice ? dice[0] === dice[1] : false;
  let nextTurn: number;
  let round = s.round;
  if (isDouble && s.doubles < 2 && s.money[turn] >= 0) {
    nextTurn = turn;
    s = { ...s, doubles: s.doubles + 1, phase: 'roll', dice: null };
  } else {
    nextTurn = (turn + 1) % s.playerIds.length;
    while (s.eliminated[nextTurn]) nextTurn = (nextTurn + 1) % s.playerIds.length;
    if (nextTurn === 0) round += 1;
    s = { ...s, turn: nextTurn, doubles: 0, phase: 'roll', dice: null, round };
  }
  // check win
  const alive = alivePlayers(s);
  if (alive.length === 1) {
    s = finish(s, alive[0], events);
  } else if (s.round > MAX_ROUNDS) {
    const ranked = alive.slice().sort((a, b) => s.money[b] - s.money[a]);
    s = finish(s, ranked[0], events);
  }
  s.eventLog = [...s.eventLog, ...events];
  return { state: s, events };
}

function eliminate(state: CityState, turn: number, events: GameEvent[]): CityState {
  const eliminated = state.eliminated.slice();
  eliminated[turn] = true;
  const properties = state.properties.map((p) => (p.owner === turn ? { ...p, owner: -1, houses: 0, mortgaged: false } : p));
  events.push({ type: 'bankrupt', playerId: state.playerIds[turn] });
  const alive = state.playerIds.map((_, i) => i).filter((i) => !eliminated[i]);
  let s: CityState = { ...state, eliminated, properties };
  if (alive.length === 1) {
    s = finish(s, alive[0], events);
  }
  return s;
}

function finish(state: CityState, winnerIndex: number, events: GameEvent[]): CityState {
  const rank = alivePlayers(state).slice().sort((a, b) => state.money[b] - state.money[a]).map((i) => state.playerIds[i]);
  events.push({ type: 'game_over', playerId: state.playerIds[winnerIndex], data: { winner: state.playerIds[winnerIndex] } });
  return { ...state, status: 'finished', result: { winner: state.playerIds[winnerIndex], rank } };
}

export function cityRanking(state: CityState): string[] {
  if (state.result) return state.result.rank;
  return alivePlayers(state).slice().sort((a, b) => state.money[b] - state.money[a]).map((i) => state.playerIds[i]);
}
