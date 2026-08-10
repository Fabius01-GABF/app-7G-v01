import { GameStatus, GameEvent } from '../../core/types';

export interface QuizQuestion {
  id: string;
  category: string;
  text: string;
  answers: string[];
  correctIndex: number;
  difficulty: 1 | 2 | 3;
}

export interface QuizState {
  playerIds: string[];
  questions: QuizQuestion[];
  current: number;
  phase: 'question' | 'reveal' | 'finished';
  answers: (number | null)[][];
  scores: number[];
  streaks: number[];
  status: GameStatus;
  result?: { winner: string; ranking: { playerId: string; score: number }[] };
  questionStartMs: number;
  durationMs: number;
  lastReveal?: { questionIndex: number; correctIndex: number; perPlayer: { playerId: string; correct: boolean; gained: number }[] };
  eventLog: GameEvent[];
}

export interface QuizConfig {
  playerIds: string[];
  questions: QuizQuestion[];
  durationMs?: number;
  nowMs?: number;
}

export function scoreBase(q: QuizQuestion): number {
  return q.difficulty === 1 ? 100 : q.difficulty === 2 ? 150 : 200;
}

export function createQuizState(config: QuizConfig): QuizState {
  const n = Math.min(4, Math.max(1, config.playerIds.length));
  const playerIds = config.playerIds.slice(0, n);
  return {
    playerIds,
    questions: config.questions,
    current: 0,
    phase: config.questions.length > 0 ? 'question' : 'finished',
    answers: new Array(n).fill(0).map(() => []),
    scores: new Array(n).fill(0),
    streaks: new Array(n).fill(0),
    status: config.questions.length > 0 ? 'playing' : 'finished',
    questionStartMs: config.nowMs ?? Date.now(),
    durationMs: config.durationMs ?? 15000,
    eventLog: [],
  };
}

export function getQuizAnswerable(state: QuizState, playerId: string): boolean {
  if (state.status === 'finished') return false;
  const idx = state.playerIds.indexOf(playerId);
  if (idx === -1) return false;
  const answered = state.answers[idx][state.current];
  return answered === undefined || answered === null;
}

export interface QuizAnswerResult {
  state: QuizState;
  events: GameEvent[];
  allAnswered: boolean;
  playerScore: number;
}

export function submitQuizAnswer(state: QuizState, playerId: string, answer: number | null, nowMs?: number): QuizAnswerResult {
  if (state.status === 'finished') throw new Error('game_over');
  const idx = state.playerIds.indexOf(playerId);
  if (idx === -1) throw new Error('not_in_game');
  const current = state.current;
  if (current >= state.questions.length) throw new Error('game_over');
  if (state.answers[idx][current] !== undefined) throw new Error('already_answered');

  const answers = state.answers.map((row) => row.slice());
  answers[idx][current] = answer;
  const events: GameEvent[] = [{ type: 'answer', playerId, data: { question: current } }];

  let s: QuizState = { ...state, answers };
  const allAnswered = state.playerIds.every((_, i) => answers[i][current] !== undefined);
  if (allAnswered) {
    s = advanceQuiz(s, nowMs);
    return { state: s, events, allAnswered: true, playerScore: s.scores[idx] };
  }
  s.eventLog = [...s.eventLog, ...events];
  return { state: s, events, allAnswered: false, playerScore: s.scores[idx] };
}

export function advanceQuiz(state: QuizState, nowMs?: number): QuizState {
  if (state.status === 'finished') return state;
  const current = state.current;
  const q = state.questions[current];
  if (!q) return { ...state, status: 'finished', phase: 'finished' };

  const now = nowMs ?? Date.now();
  const elapsed = Math.max(0, Math.min(state.durationMs, now - state.questionStartMs));
  const speedFactor = 1 - elapsed / state.durationMs;

  const perPlayer: { playerId: string; correct: boolean; gained: number }[] = [];
  const scores = state.scores.slice();
  const streaks = state.streaks.slice();

  for (let i = 0; i < state.playerIds.length; i++) {
    const a = state.answers[i][current];
    const correct = a === q.correctIndex;
    if (correct) {
      streaks[i] += 1;
      const gained = Math.round(scoreBase(q) + 50 * speedFactor + Math.min(100, streaks[i] * 25));
      scores[i] += gained;
      perPlayer.push({ playerId: state.playerIds[i], correct: true, gained });
    } else {
      streaks[i] = 0;
      perPlayer.push({ playerId: state.playerIds[i], correct: false, gained: 0 });
    }
  }

  const next = current + 1;
  let s: QuizState = {
    ...state,
    scores,
    streaks,
    current: next,
    questionStartMs: now,
    lastReveal: { questionIndex: current, correctIndex: q.correctIndex, perPlayer },
  };

  const events: GameEvent[] = [{ type: 'reveal', data: { questionIndex: current, correctIndex: q.correctIndex } }];

  if (next >= state.questions.length) {
    const ranking = state.playerIds
      .map((pid, i) => ({ playerId: pid, score: scores[i] }))
      .sort((a, b) => b.score - a.score);
    s = {
      ...s,
      phase: 'finished',
      status: 'finished',
      result: { winner: ranking[0]?.playerId ?? state.playerIds[0], ranking },
    };
    events.push({ type: 'game_over', data: { winner: s.result?.winner } });
  } else {
    // reset answers for next question
    s = { ...s, phase: 'question', answers: state.playerIds.map((_, i) => [...s.answers[i].slice(0, next)]) };
  }
  s.eventLog = [...s.eventLog, ...events];
  return s;
}

export function quizAnswerAccuracy(difficulty: 'easy' | 'medium' | 'hard', rng: () => number = Math.random): boolean {
  const p = difficulty === 'easy' ? 0.5 : difficulty === 'medium' ? 0.7 : 0.9;
  return rng() < p;
}
