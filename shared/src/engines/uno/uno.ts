import { GameStatus, GameEvent } from '../../core/types';
import { shuffle, createRng } from '../../core/rng';

export type UnoColor = 'r' | 'y' | 'g' | 'b';
export type UnoValue = number | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

export interface UnoCard {
  color: UnoColor | null;
  value: UnoValue;
}

export const UNO_COLORS: UnoColor[] = ['r', 'y', 'g', 'b'];

export function buildDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  for (const c of UNO_COLORS) {
    deck.push({ color: c, value: 0 });
    for (let i = 1; i <= 9; i++) {
      deck.push({ color: c, value: i });
      deck.push({ color: c, value: i });
    }
    for (const v of ['skip', 'reverse', 'draw2'] as UnoValue[]) {
      deck.push({ color: c, value: v });
      deck.push({ color: c, value: v });
    }
  }
  for (let i = 0; i < 4; i++) deck.push({ color: null, value: 'wild' });
  for (let i = 0; i < 4; i++) deck.push({ color: null, value: 'wild4' });
  return deck;
}

export function cardLabel(c: UnoCard): string {
  if (c.color === null) return c.value === 'wild' ? 'WILD' : 'WILD +4';
  const col = { r: 'R', y: 'Y', g: 'G', b: 'B' }[c.color];
  const v = typeof c.value === 'number' ? String(c.value) : { skip: 'SKIP', reverse: 'REV', draw2: '+2', wild: 'WILD', wild4: 'WILD+4' }[c.value];
  return `${col} ${v}`;
}

export interface UnoAction {
  type: 'play';
  card: number;
  color?: UnoColor;
}

export interface UnoDrawAction {
  type: 'draw';
}

export type UnoAnyAction = UnoAction | UnoDrawAction;

export interface UnoState {
  playerIds: string[];
  hands: UnoCard[][];
  drawPile: UnoCard[];
  discard: UnoCard[];
  currentColor: UnoColor | null;
  turn: number;
  direction: 1 | -1;
  status: GameStatus;
  result?: { winner: string; scores: Record<string, number> };
  eventLog: GameEvent[];
  pendingDraw: number; // cards to draw accumulated by last +2/+4
}

export interface UnoConfig {
  playerIds: string[];
  seed?: number;
}

export function createUnoState(config: UnoConfig): UnoState {
  const rng = createRng(config.seed);
  const n = Math.min(8, Math.max(2, config.playerIds.length));
  const deck = shuffle(buildDeck(), rng);
  const hands: UnoCard[][] = [];
  for (let i = 0; i < n; i++) hands.push(deck.splice(0, 7));
  let first = deck.pop()!;
  while (first.color === null) {
    deck.unshift(first);
    first = deck.pop()!;
  }
  const drawPile = deck;
  const currentColor = first.color;
  return {
    playerIds: config.playerIds.slice(0, n),
    hands,
    drawPile,
    discard: [first],
    currentColor,
    turn: 0,
    direction: 1,
    status: 'playing',
    eventLog: [],
    pendingDraw: 0,
  };
}

export function canPlay(state: UnoState, card: UnoCard): boolean {
  if (card.color === null) return true;
  if (state.currentColor !== null && card.color === state.currentColor) return true;
  const top = state.discard[state.discard.length - 1];
  return top.value === card.value;
}

export function getUnoActions(state: UnoState, playerId?: string): UnoAnyAction[] {
  if (state.status === 'finished') return [];
  const turn = playerId !== undefined ? state.playerIds.indexOf(playerId) : state.turn;
  if (turn !== state.turn) return [];
  const hand = state.hands[turn];
  const playable: UnoAction[] = [];
  for (let i = 0; i < hand.length; i++) {
    if (!canPlay(state, hand[i])) continue;
    if (hand[i].color === null) {
      for (const c of UNO_COLORS) playable.push({ type: 'play', card: i, color: c });
    } else {
      playable.push({ type: 'play', card: i });
    }
  }
  if (playable.length === 0) return [{ type: 'draw' }];
  return [...playable, { type: 'draw' }];
}

function cardsOut(state: UnoState, n: number, player: number): { drawn: UnoCard[]; pile: UnoCard[]; discard: UnoCard[] } {
  const drawn: UnoCard[] = [];
  let pile = state.drawPile.slice();
  let discard = state.discard.slice();
  for (let i = 0; i < n; i++) {
    if (pile.length === 0) {
      if (discard.length <= 1) break;
      const top = discard.pop()!;
      const reshuffled = shuffle(discard, Math.random);
      pile.push(...reshuffled);
      discard = [top];
    }
    drawn.push(pile.pop()!);
  }
  return { drawn, pile, discard };
}

function nextPlayer(state: UnoState, steps: number, direction?: number): number {
  const n = state.playerIds.length;
  const d = direction ?? state.direction;
  return ((state.turn + d * steps) % n + n) % n;
}

export function computeScore(c: UnoCard): number {
  if (typeof c.value === 'number') return c.value;
  if (c.value === 'wild' || c.value === 'wild4') return 50;
  return 20;
}

export function applyUnoAction(state: UnoState, action: UnoAnyAction, playerId?: string): { state: UnoState; events: GameEvent[] } {
  if (state.status === 'finished') return { state, events: [] };
  const turn = playerId !== undefined ? state.playerIds.indexOf(playerId) : state.turn;
  if (turn !== state.turn) throw new Error('not_your_turn');

  const events: GameEvent[] = [];
  const legal = getUnoActions(state, playerId);

  if (action.type === 'draw') {
    if (!legal.some((a) => a.type === 'draw')) throw new Error('invalid_action');
    const { drawn, pile, discard } = cardsOut(state, 1, turn);
    const hands = state.hands.map((h) => h.slice());
    hands[turn].push(...drawn);
    const nextTurn = nextPlayer(state, 1);
    events.push({ type: 'draw', playerId: state.playerIds[turn], data: { count: drawn.length } });
    const s: UnoState = {
      ...state,
      hands,
      drawPile: pile,
      discard,
      turn: nextTurn,
      currentColor: state.currentColor,
      eventLog: [...state.eventLog, ...events],
    };
    return { state: s, events };
  }

  // play
  if (!legal.some((a) => a.type === 'play' && a.card === action.card && (a.color ?? undefined) === action.color)) {
    throw new Error('illegal_move');
  }
  const card = state.hands[turn][action.card];
  const hands = state.hands.map((h) => h.slice());
  hands[turn].splice(action.card, 1);
  let currentColor = action.color ?? card.color;
  let direction = state.direction;
  let steps = 1;
  let extraDraw = 0;
  let nextTurn: number;

  events.push({ type: 'play', playerId: state.playerIds[turn], data: { card: cardLabel(card), color: currentColor } });

  if (card.value === 'skip') {
    steps = 2;
    events.push({ type: 'effect', data: { effect: 'skip' } });
  } else if (card.value === 'reverse') {
    if (state.playerIds.length === 2) {
      steps = 2;
    } else {
      direction = (direction * -1) as 1 | -1;
    }
    events.push({ type: 'effect', data: { effect: 'reverse' } });
  } else if (card.value === 'draw2') {
    extraDraw = 2;
    steps = 2;
    events.push({ type: 'effect', data: { effect: 'draw2' } });
  } else if (card.value === 'wild4') {
    extraDraw = 4;
    steps = 2;
    events.push({ type: 'effect', data: { effect: 'wild4' } });
  }

  const discard = [...state.discard, { ...card, color: currentColor }];

  nextTurn = nextPlayer(state, steps, direction);

  let s: UnoState = {
    ...state,
    hands,
    discard,
    currentColor,
    direction,
    turn: nextTurn,
    eventLog: [...state.eventLog, ...events],
  };

  if (extraDraw > 0) {
    const target = s.turn;
    const res = cardsOut(s, extraDraw, target);
    const hands2 = s.hands.map((h) => h.slice());
    hands2[target].push(...res.drawn);
    s = { ...s, hands: hands2, drawPile: res.pile, discard: res.discard };
    events.push({ type: 'draw', playerId: state.playerIds[target], data: { count: res.drawn.length } });
  }

  if (s.hands[turn].length === 0) {
    const scores: Record<string, number> = {};
    for (let i = 0; i < state.playerIds.length; i++) {
      if (i === turn) continue;
      scores[state.playerIds[i]] = s.hands[i].reduce((sum, c) => sum + computeScore(c), 0);
    }
    s = {
      ...s,
      status: 'finished',
      result: { winner: state.playerIds[turn], scores },
      eventLog: [...s.eventLog, { type: 'game_over', playerId: state.playerIds[turn], data: { winner: state.playerIds[turn] } }],
    };
    return { state: s, events };
  }

  if (s.hands[turn].length === 1) events.push({ type: 'uno', playerId: state.playerIds[turn] });

  s.eventLog = [...s.eventLog, ...events];
  return { state: s, events };
}
