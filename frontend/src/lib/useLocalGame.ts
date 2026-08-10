import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adapters, advanceQuiz, type AiDifficulty, type GameKind } from '@shared/index';
import type { QuizState } from '@shared/index';
import { mulberry32 } from '@shared/core/rng';

export interface LocalGame {
  state: unknown;
  finished: boolean;
  winner: string | null;
  ranking: string[];
  actingId: string | null;
  humanActing: boolean;
  actions: unknown[];
  humanPlayerIds: string[];
  apply: (a: unknown) => void;
  restart: () => void;
}

export function currentPlayerId(state: unknown): string | null {
  const s = state as { playerIds: string[]; turn: unknown; status?: string };
  if (!s || !s.playerIds || s.status === 'finished') return null;
  // quiz: acting player = first player who hasn't answered the current question (null = unanswered)
  const q = state as {
    phase?: string;
    answers?: (number | null)[][];
    current?: number;
    questions?: unknown[];
  };
  if (q.phase === 'question' && Array.isArray(q.answers) && q.current !== undefined) {
    for (let i = 0; i < s.playerIds.length; i++) {
      const a = q.answers[i]?.[q.current];
      if (a === null) return s.playerIds[i];
    }
    return null;
  }
  if (typeof s.turn === 'string' && (s.turn === 'w' || s.turn === 'b')) {
    return s.playerIds[s.turn === 'w' ? 0 : 1] ?? null;
  }
  const idx = Number(s.turn);
  return Number.isFinite(idx) && idx >= 0 ? s.playerIds[idx] ?? null : null;
}

function isQuizTimer(state: unknown): boolean {
  const s = state as { phase?: string; status?: string };
  return s?.phase === 'question' && s?.status === 'playing';
}

export interface LocalGameOptions {
  playerIds: string[];
  humanSlots?: number[];
  difficulty: AiDifficulty;
  config?: unknown;
}

export function useLocalGame(kind: GameKind, mode: 'solo' | 'local', opts: LocalGameOptions): LocalGame {
  const seedRef = useRef(Math.floor(Math.random() * 0xffffffff));
  const rngRef = useRef<() => number>(Math.random);
  const playerIds = opts.playerIds;

  const makeConfig = () =>
    ({
      ...((opts.config as Record<string, unknown> | undefined) ?? {}),
      playerIds,
      seed: seedRef.current,
    } as never);

  const [state, setState] = useState<unknown>(() => {
    rngRef.current = mulberry32(seedRef.current);
    return adapters[kind].create(makeConfig());
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const humanPlayerIds = useMemo(() => {
    if (mode === 'solo') {
      const slots = opts.humanSlots ?? [0];
      return slots.map((i) => playerIds[i]).filter(Boolean);
    }
    return playerIds;
  }, [mode, opts.humanSlots, playerIds]);

  const actingId = currentPlayerId(state);
  const finished = (state as { status?: string }).status === 'finished';
  const humanActing = !finished && actingId !== null && humanPlayerIds.includes(actingId);
  const actions = humanActing ? adapters[kind].getActions(state, actingId ?? undefined) : [];

  const apply = useCallback(
    (action: unknown) => {
      const cur = stateRef.current;
      const actor = currentPlayerId(cur);
      if (!actor) return;
      const out = adapters[kind].apply(cur, action, actor, rngRef.current);
      setState(out.state);
    },
    [kind],
  );

  const restart = useCallback(() => {
    seedRef.current = Math.floor(Math.random() * 0xffffffff);
    rngRef.current = mulberry32(seedRef.current);
    setState(adapters[kind].create(makeConfig()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, playerIds]);

  // AI driver (solo) — also drives quiz AI answers
  useEffect(() => {
    if (mode !== 'solo') return;
    if (finished) return;
    const actor = currentPlayerId(state);
    if (!actor || humanPlayerIds.includes(actor)) return;
    const t = setTimeout(() => {
      const cur = stateRef.current;
      const curActor = currentPlayerId(cur);
      if (!curActor || (cur as { status?: string }).status === 'finished') return;
      const aiAction = adapters[kind].chooseAi(cur, opts.difficulty, rngRef.current, curActor);
      if (aiAction === null || aiAction === undefined) return;
      const out = adapters[kind].apply(cur, aiAction, curActor, rngRef.current);
      setState(out.state);
    }, 650);
    return () => clearTimeout(t);
  }, [state, mode, finished, humanPlayerIds, kind, opts.difficulty]);

  // Quiz auto-advance timer
  useEffect(() => {
    if (kind !== 'quiz' || finished) return;
    if (!isQuizTimer(state)) return;
    const id = setInterval(() => {
      const cur = stateRef.current as QuizState;
      if (!isQuizTimer(cur)) {
        clearInterval(id);
        return;
      }
      const deadline = cur.questionStartMs + cur.durationMs;
      if (Date.now() >= deadline) {
        const next = advanceQuiz(cur, deadline);
        if (next !== cur) setState(next);
        clearInterval(id);
      }
    }, 200);
    return () => clearInterval(id);
  }, [state, kind, finished]);

  return {
    state,
    finished,
    winner: finished ? adapters[kind].winner(state) : null,
    ranking: finished ? adapters[kind].ranking(state) : [],
    actingId,
    humanActing,
    actions,
    humanPlayerIds,
    apply,
    restart,
  };
}
