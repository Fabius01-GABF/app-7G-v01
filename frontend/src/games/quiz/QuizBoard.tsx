import { useEffect, useRef, useState } from 'react';
import type { QuizState } from '@shared/index';

interface Props {
  state: QuizState;
  canAct: boolean;
  actions: unknown[];
  meId: string;
  onAction: (a: { type: 'answer'; answer: number }) => void;
  players: string[];
  online?: boolean;
}

export function QuizBoard({ state, canAct, actions, meId, onAction, players }: Props) {
  const [now, setNow] = useState(Date.now());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (state.status !== 'playing') return;
    timerRef.current = window.setInterval(() => setNow(Date.now()), 200);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [state.status, state.current]);

  const me = players.indexOf(meId);
  const myAnswer = state.answers[me]?.[state.current];
  const progress = Math.max(0, Math.min(1, 1 - (now - state.questionStartMs) / state.durationMs));

  if (state.status === 'finished') {
    return (
      <div className="board-wrap">
        <div className="card center">
          <h3>Quiz terminé !</h3>
          {state.result && (
            <div className="col mt">
              {state.result.ranking.map((r, i) => (
                <div key={r.playerId} className={`row-between${r.playerId === state.result?.winner ? '' : ''}`}>
                  <span>
                    {i + 1}. {players.includes(r.playerId) ? players[players.indexOf(r.playerId)] : r.playerId}
                    {r.playerId === state.result?.winner ? ' 🏆' : ''}
                  </span>
                  <b>{r.score} pts</b>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const q = state.questions[state.current];
  const revealed = state.lastReveal && state.lastReveal.questionIndex < state.current;

  return (
    <div className="board-wrap">
      <div className="row-between">
        <div>
          <h3>7G Quiz</h3>
          <span className="dim" style={{ fontSize: 13 }}>
            Question {state.current + 1}/{state.questions.length}
          </span>
        </div>
        <div className="row">
          <span className="pill">Score : {state.scores[me] ?? 0}</span>
        </div>
      </div>

      <div style={{ height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${progress * 100}%`,
            background: progress > 0.3 ? 'var(--green)' : 'var(--red)',
            transition: 'width 0.2s linear',
          }}
        />
      </div>

      {revealed && state.lastReveal && (
        <div className="card" style={{ borderColor: 'var(--green)', borderWidth: 2 }}>
          <h3>Résultats</h3>
          {state.lastReveal.perPlayer.map((r) => (
            <div key={r.playerId} className="row-between">
              <span>{players.includes(r.playerId) ? players[players.indexOf(r.playerId)] : r.playerId}</span>
              <span style={{ color: r.correct ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                {r.correct ? `+${r.gained} ✓` : '✗'}
              </span>
            </div>
          ))}
        </div>
      )}

      {q && (
        <div className="card">
          <h3>{q.text}</h3>
          <div className="col mt">
            {q.answers.map((a, i) => {
              const answered = myAnswer !== undefined && myAnswer !== null;
              const chosen = myAnswer === i;
              return (
                <button
                  key={i}
                  className="btn btn-ghost btn-block"
                  disabled={!canAct || answered}
                  onClick={() => onAction({ type: 'answer', answer: i })}
                  style={{
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    borderColor: chosen ? 'var(--accent)' : undefined,
                    background: chosen ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : undefined,
                  }}
                >
                  {String.fromCharCode(65 + i)}. {a}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {canAct && myAnswer === undefined && <p className="dim center" style={{ fontSize: 13 }}>Répondez rapidement pour gagner plus de points !</p>}
      {!canAct && state.status === 'playing' && <p className="dim center" style={{ fontSize: 13 }}>En attente des autres joueurs…</p>}

      <div className="player-strip">
        {players.map((p, i) => (
          <span key={p} className={`pchip${state.answers[i]?.[state.current] === undefined || state.answers[i]?.[state.current] === null ? '' : ' turn'}`}>
            {p} · {state.scores[i] ?? 0}
          </span>
        ))}
      </div>
    </div>
  );
}
