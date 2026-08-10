import { adapters, defaultQuizQuestions, advanceQuiz, type GameKind, type AiDifficulty } from '../shared/src/index';
import { mulberry32 } from '../shared/src/core/rng';

function currentPlayerId(state: unknown): string | null {
  const s = state as { playerIds: string[]; turn: unknown; status?: string };
  if (!s || !s.playerIds || s.status === 'finished') return null;
  const q = state as { phase?: string; answers?: (number | null)[][]; current?: number };
  if (q.phase === 'question' && Array.isArray(q.answers) && q.current !== undefined) {
    for (let i = 0; i < s.playerIds.length; i++) if (q.answers[i]?.[q.current] === null) return s.playerIds[i];
    return null;
  }
  if (typeof s.turn === 'string' && (s.turn === 'w' || s.turn === 'b')) return s.playerIds[s.turn === 'w' ? 0 : 1] ?? null;
  const idx = Number(s.turn);
  return Number.isFinite(idx) && idx >= 0 ? s.playerIds[idx] ?? null : null;
}

const kinds: GameKind[] = ['chess', 'checkers', 'ludo', 'city', 'uno', 'domino', 'quiz'];
const results: Record<string, { turns: number; status: string; winner: string | null; ranking: string[] }> = {};

for (const kind of kinds) {
  const n = 2;
  const playerIds = Array.from({ length: n }, (_, i) => `p${i}`);
  const seed = 12345;
  let rng = mulberry32(seed);
  const config: Record<string, unknown> = { playerIds, seed };
  if (kind === 'quiz') config.questions = [...defaultQuizQuestions].slice(0, 8);
  let state: unknown = adapters[kind].create(config as never);
  let turns = 0;
  let guard = 0;
  const maxTurns = 20000;
  const t0 = Date.now();
  while (adapters[kind].isFinished(state) === false && guard < maxTurns) {
    guard++;
    if (guard % 2000 === 0) console.log(`  [${kind}] ${guard} turns... round=${(state as { round?: number }).round ?? '-'} phase=${(state as { phase?: string }).phase ?? '-'}`);
    const acting = currentPlayerId(state);
    if (!acting) {
      if (kind === 'quiz') {
        const s = state as { phase: string; current: number; questions: unknown[] };
        if (s.phase === 'question' && s.current < s.questions.length) {
          state = advanceQuiz(state as never, Date.now());
          turns++;
          continue;
        }
      }
      break;
    }
    rng = mulberry32(seed + guard);
    const action = adapters[kind].chooseAi(state, 'hard' as AiDifficulty, rng, acting);
    if (action === null || action === undefined) break;
    const out = adapters[kind].apply(state, action, acting, rng);
    state = out.state;
    turns++;
  }
  results[kind] = {
    turns,
    status: (state as { status?: string }).status ?? '?',
    winner: adapters[kind].winner(state),
    ranking: adapters[kind].ranking(state),
  };
  console.log(`  [${kind}] done in ${Date.now() - t0} ms`);
}

let pass = 0;
for (const [k, r] of Object.entries(results)) {
  const ok = r.status === 'finished' && r.ranking.length > 0;
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${k}: turns=${r.turns} status=${r.status} winner=${r.winner} ranking=[${r.ranking}]`);
}
console.log(`SUMMARY ${pass}/${Object.keys(results).length}`);
