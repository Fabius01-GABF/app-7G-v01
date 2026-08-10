import { describe, it, expect } from 'vitest';
import { createQuizState, submitQuizAnswer, scoreBase, QuizQuestion } from './quiz';

const q1: QuizQuestion = { id: 'q1', category: 'math', text: '1+1?', answers: ['1', '2', '3'], correctIndex: 1, difficulty: 1 };
const q2: QuizQuestion = { id: 'q2', category: 'geo', text: 'capitale?', answers: ['A', 'B', 'C'], correctIndex: 0, difficulty: 3 };

describe('7G Quiz', () => {
  it('starts in question phase with zero scores', () => {
    const s = createQuizState({ playerIds: ['a', 'b'], questions: [q1], nowMs: 0 });
    expect(s.phase).toBe('question');
    expect(s.scores).toEqual([0, 0]);
    expect(s.current).toBe(0);
  });

  it('scores correct answers and finishes after the last question', () => {
    const s = createQuizState({ playerIds: ['a', 'b'], questions: [q1], nowMs: 0, durationMs: 10000 });
    const r1 = submitQuizAnswer(s, 'a', 1, 10000); // elapsed = full duration -> no speed bonus
    expect(r1.allAnswered).toBe(false);
    const r2 = submitQuizAnswer(r1.state, 'b', 0, 10000); // wrong
    expect(r2.allAnswered).toBe(true);
    const st = r2.state;
    expect(st.status).toBe('finished');
    expect(st.result?.winner).toBe('a');
    expect(st.result?.ranking[0]).toEqual({ playerId: 'a', score: scoreBase(q1) + 25 }); // 100 + first streak bonus
    expect(st.result?.ranking[1].score).toBe(0);
  });

  it('rejects a second answer from the same player', () => {
    const s = createQuizState({ playerIds: ['a', 'b'], questions: [q1], nowMs: 0 });
    const r1 = submitQuizAnswer(s, 'a', 1, 0);
    expect(() => submitQuizAnswer(r1.state, 'a', 1, 0)).toThrow('already_answered');
  });

  it('rejects answering after the game is finished', () => {
    const s = createQuizState({ playerIds: ['a', 'b'], questions: [q1], nowMs: 0, durationMs: 1000 });
    const r1 = submitQuizAnswer(s, 'a', 1, 1000);
    const r2 = submitQuizAnswer(r1.state, 'b', 1, 1000);
    expect(r2.state.status).toBe('finished');
    expect(() => submitQuizAnswer(r2.state, 'a', 1, 1000)).toThrow('game_over');
  });

  it('treats a null answer (timeout) as wrong', () => {
    const s = createQuizState({ playerIds: ['a', 'b'], questions: [q2], nowMs: 0, durationMs: 1000 });
    const r1 = submitQuizAnswer(s, 'a', null, 1000);
    const r2 = submitQuizAnswer(r1.state, 'b', 0, 1000);
    expect(r2.state.result?.ranking[0].playerId).toBe('b');
    expect(r2.state.result?.ranking[0].score).toBe(scoreBase(q2) + 25);
  });
});
