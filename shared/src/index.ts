import { GameEvent } from './core/types';

import { createChessState, applyChessMove, getLegalMoves, ChessState, ChessConfig, ChessOutcome, Move, chessMeta, chessNotation, squareName, colorOf, inCheck } from './engines/chess/chess';
import { chooseChessMove } from './engines/chess/ai';

import { createCheckersState, applyCheckersMove, getCheckersMoves, CheckersState, CheckersConfig, CheckersOutcome, CheckersMove } from './engines/checkers/checkers';
import { chooseCheckersMove } from './engines/checkers/ai';

import { createLudoState, applyLudoAction, getLudoActions, LudoState, LudoConfig, LudoAction, ludoRanking, LUDO_RING, ringPos, safeSquares } from './engines/ludo/ludo';

import { createCityState, applyCityAction, getCityActions, CityState, CityConfig, CityAction, cityRanking, CITY_BOARD, CITY_SIZE, rentOf, houseCost } from './engines/monopoly/city';
import { chooseCityAction } from './engines/monopoly/ai';

import { createUnoState, applyUnoAction, getUnoActions, UnoState, UnoConfig, UnoAnyAction, UnoColor, buildDeck, cardLabel } from './engines/uno/uno';
import { chooseUnoAction } from './engines/uno/ai';

import { createDominoState, applyDominoAction, getDominoActions, DominoState, DominoConfig, DominoAction, DOMINO_TILES } from './engines/domino/domino';
import { chooseDominoAction } from './engines/domino/ai';

import { createQuizState, submitQuizAnswer, advanceQuiz, getQuizAnswerable, QuizState, QuizConfig, QuizQuestion, quizAnswerAccuracy } from './engines/quiz/quiz';
import { DEFAULT_QUESTIONS } from './engines/quiz/questions';

export type GameKind = 'chess' | 'checkers' | 'ludo' | 'city' | 'uno' | 'domino' | 'quiz';
export type AiDifficulty = 'easy' | 'medium' | 'hard';

export interface GameMeta {
  id: GameKind;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  solo: boolean;
  local: boolean;
  online: boolean;
  durationMin: number;
  emoji: string;
  blurb: string;
}

export interface GameAdapter<S = any, A = any, C = any> {
  id: GameKind;
  meta: GameMeta;
  create(config: C): S;
  getActions(state: S, playerId?: string): A[];
  apply(state: S, action: A, playerId?: string, rng?: () => number): { state: S; events: GameEvent[] };
  isFinished(state: S): boolean;
  winner(state: S): string | null;
  chooseAi(state: S, difficulty: AiDifficulty, rng?: () => number, playerId?: string): A | null;
  ranking(state: S): string[];
  supports: { solo: boolean; local: boolean; online: boolean };
}

export const META: Record<GameKind, GameMeta> = {
  chess: { id: 'chess', name: '7G Chess', minPlayers: 2, maxPlayers: 2, solo: true, local: true, online: true, durationMin: 15, emoji: '♞', blurb: 'Stratégie, échec et mat' },
  checkers: { id: 'checkers', name: '7G Checkers', minPlayers: 2, maxPlayers: 2, solo: true, local: true, online: true, durationMin: 10, emoji: '⚪', blurb: 'Captures et dames' },
  ludo: { id: 'ludo', name: '7G Ludo', minPlayers: 2, maxPlayers: 4, solo: true, local: true, online: true, durationMin: 15, emoji: '🎲', blurb: 'Course de pions' },
  city: { id: 'city', name: '7G City', minPlayers: 2, maxPlayers: 6, solo: true, local: true, online: false, durationMin: 25, emoji: '🏙️', blurb: 'Immobilier et stratégie' },
  uno: { id: 'uno', name: '7G Uno', minPlayers: 2, maxPlayers: 8, solo: true, local: true, online: true, durationMin: 10, emoji: '🃏', blurb: 'Cartes, couleurs, actions' },
  domino: { id: 'domino', name: '7G Domino', minPlayers: 2, maxPlayers: 4, solo: true, local: true, online: true, durationMin: 12, emoji: '🁢', blurb: 'Associez les dominos' },
  quiz: { id: 'quiz', name: '7G Quiz', minPlayers: 1, maxPlayers: 4, solo: true, local: true, online: true, durationMin: 5, emoji: '🧠', blurb: 'Culture générale' },
};

export const GAMES: GameMeta[] = Object.values(META);

export function getMeta(kind: GameKind): GameMeta {
  return META[kind];
}

export const adapters: Record<GameKind, GameAdapter> = {
  chess: {
    id: 'chess',
    meta: META.chess,
    create: (c: ChessConfig) => createChessState(c),
    getActions: (s: ChessState, p?: string) => (p ? getLegalMoves(s).filter(() => true) : getLegalMoves(s)),
    apply: (s: ChessState, a: Move, p?: string, rng?: () => number) => applyChessMove(s, a, p),
    isFinished: (s: ChessState) => s.status === 'finished',
    winner: (s: ChessState) => s.result?.winner ?? null,
    chooseAi: (s: ChessState, d: AiDifficulty, rng?: () => number, p?: string) => chooseChessMove(s, d, rng),
    ranking: (s: ChessState) => (s.result?.winner ? [...s.playerIds.filter((x) => x !== s.result!.winner), s.result.winner].reverse() : s.playerIds),
    supports: { solo: true, local: true, online: true },
  },
  checkers: {
    id: 'checkers',
    meta: META.checkers,
    create: (c: CheckersConfig) => createCheckersState(c),
    getActions: (s: CheckersState, p?: string) => getCheckersMoves(s, p),
    apply: (s: CheckersState, a: CheckersMove, p?: string) => applyCheckersMove(s, a, p),
    isFinished: (s: CheckersState) => s.status === 'finished',
    winner: (s: CheckersState) => s.result?.winner ?? null,
    chooseAi: (s: CheckersState, d: AiDifficulty, rng?: () => number) => chooseCheckersMove(s, d, rng),
    ranking: (s: CheckersState) => (s.result?.winner ? s.playerIds.filter((x) => x !== s.result!.winner).concat(s.result.winner) : s.playerIds),
    supports: { solo: true, local: true, online: true },
  },
  ludo: {
    id: 'ludo',
    meta: META.ludo,
    create: (c: LudoConfig) => createLudoState(c),
    getActions: (s: LudoState, p?: string) => getLudoActions(s, p),
    apply: (s: LudoState, a: LudoAction, p?: string, rng?: () => number) => applyLudoAction(s, a, p, rng),
    isFinished: (s: LudoState) => s.status === 'finished',
    winner: (s: LudoState) => s.result?.winner ?? null,
    chooseAi: (s: LudoState, d: AiDifficulty, rng?: () => number) => chooseLudoAction(s, d, rng),
    ranking: (s: LudoState) => ludoRanking(s),
    supports: { solo: true, local: true, online: true },
  },
  city: {
    id: 'city',
    meta: META.city,
    create: (c: CityConfig) => createCityState(c),
    getActions: (s: CityState, p?: string) => getCityActions(s, p),
    apply: (s: CityState, a: CityAction, p?: string, rng?: () => number) => applyCityAction(s, a, p, rng),
    isFinished: (s: CityState) => s.status === 'finished',
    winner: (s: CityState) => s.result?.winner ?? null,
    chooseAi: (s: CityState, d: AiDifficulty, rng?: () => number) => chooseCityAction(s, d, rng),
    ranking: (s: CityState) => cityRanking(s),
    supports: { solo: true, local: true, online: false },
  },
  uno: {
    id: 'uno',
    meta: META.uno,
    create: (c: UnoConfig) => createUnoState(c),
    getActions: (s: UnoState, p?: string) => getUnoActions(s, p),
    apply: (s: UnoState, a: UnoAnyAction, p?: string) => applyUnoAction(s, a, p),
    isFinished: (s: UnoState) => s.status === 'finished',
    winner: (s: UnoState) => s.result?.winner ?? null,
    chooseAi: (s: UnoState, d: AiDifficulty, rng?: () => number) => chooseUnoAction(s, d, rng),
    ranking: (s: UnoState) => (s.result ? Object.keys(s.result.scores) : s.playerIds),
    supports: { solo: true, local: true, online: true },
  },
  domino: {
    id: 'domino',
    meta: META.domino,
    create: (c: DominoConfig) => createDominoState(c),
    getActions: (s: DominoState, p?: string) => getDominoActions(s, p),
    apply: (s: DominoState, a: DominoAction, p?: string, rng?: () => number) => applyDominoAction(s, a, p, rng),
    isFinished: (s: DominoState) => s.status === 'finished',
    winner: (s: DominoState) => s.result?.winner ?? null,
    chooseAi: (s: DominoState, d: AiDifficulty, rng?: () => number) => chooseDominoAction(s, d, rng),
    ranking: (s: DominoState) => s.playerIds,
    supports: { solo: true, local: true, online: true },
  },
  quiz: {
    id: 'quiz',
    meta: META.quiz,
    create: (c: QuizConfig) => createQuizState(c),
    getActions: (s: QuizState, p?: string) => (p ? [{ type: 'answer' }] : [{ type: 'answer' }]),
    apply: (s: QuizState, a: any, p?: string) => submitQuizAnswer(s, p ?? s.playerIds[0], a.answer ?? null),
    isFinished: (s: QuizState) => s.status === 'finished',
    winner: (s: QuizState) => s.result?.winner ?? null,
    chooseAi: (s: QuizState, d: AiDifficulty, rng?: () => number) => ({ type: 'answer', answer: pickQuizAi(s, d, rng ?? Math.random) }),
    ranking: (s: QuizState) => s.result?.ranking.map((r) => r.playerId) ?? s.playerIds,
    supports: { solo: true, local: true, online: true },
  },
};

function chooseLudoAction(state: LudoState, difficulty: AiDifficulty, rng: () => number = Math.random): LudoAction | null {
  const actions = getLudoActions(state, state.playerIds[state.turn]);
  if (actions.length === 0) return null;
  if (actions.length === 1) return actions[0];
  const moves = actions.filter((a) => a.type === 'move') as LudoAction[];
  if (moves.length === 0) return actions[0];
  // prefer moving pawns closest to home (excluding capture decisions) - simple heuristic
  if (difficulty === 'easy') {
    if (rng() < 0.3) return moves[Math.floor(rng() * moves.length)];
    return moves[moves.length - 1];
  }
  return moves[moves.length - 1];
}

function pickQuizAi(state: QuizState, difficulty: AiDifficulty, rng: () => number): number | null {
  if (state.current >= state.questions.length) return null;
  const q = state.questions[state.current];
  const correct = quizAnswerAccuracy(difficulty, rng);
  if (correct) return q.correctIndex;
  const others = q.answers.map((_, i) => i).filter((i) => i !== q.correctIndex);
  return others[Math.floor(rng() * others.length)];
}

export type {
  ChessState, ChessConfig, Move as ChessMove,
  CheckersState, CheckersConfig, CheckersMove,
  LudoState, LudoConfig, LudoAction,
  CityState, CityConfig, CityAction,
  UnoState, UnoConfig, UnoAnyAction, UnoColor,
  DominoState, DominoConfig, DominoAction,
  QuizState, QuizConfig, QuizQuestion,
};

export {
  chessNotation, squareName, colorOf, inCheck,
  LUDO_RING, ringPos, safeSquares,
  CITY_BOARD, CITY_SIZE, rentOf, houseCost,
  buildDeck, cardLabel,
  DOMINO_TILES,
  getQuizAnswerable, advanceQuiz, submitQuizAnswer,
  DEFAULT_QUESTIONS,
};

// re-export default questions for seeding
export const defaultQuizQuestions = DEFAULT_QUESTIONS;
