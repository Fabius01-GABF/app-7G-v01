import { GAMES } from '../../shared/src/index';
import { DEFAULT_QUESTIONS } from '../../shared/src/engines/quiz/questions';
import type { QuizQuestion } from '../../shared/src/engines/quiz/quiz';
import { loadConfig } from './config';
import { openDb } from './db';
import { Repo } from './repo';
import { hashPassword } from './security';

export function seedAdmin(repo: Repo, env: NodeJS.ProcessEnv = process.env): void {
  const username = env.ADMIN_USERNAME?.trim();
  const email = env.ADMIN_EMAIL?.trim();
  const password = env.ADMIN_PASSWORD;
  if (!username || !email || !password) return;
  if (repo.findUserByUsername(username) || repo.findUserByEmail(email)) return;
  if (password.length < 8) {
    console.warn('[7gzone] ADMIN_PASSWORD trop court (8+ requis) — admin non créé.');
    return;
  }
  const id = repo.createUser(username, email, hashPassword(password));
  repo.createProfile(id, null, null);
  repo.setUserRole(id, 'super_admin');
  console.log(`[7gzone] compte super admin créé: ${username}`);
}

export function seedDefaults(repo: Repo): void {
  seedAdmin(repo);
  for (const g of GAMES) {
    repo.upsertGame({
      id: g.id,
      name: g.name,
      min_players: g.minPlayers,
      max_players: g.maxPlayers,
      solo: g.solo ? 1 : 0,
      local: g.local ? 1 : 0,
      online: g.online ? 1 : 0,
      duration_min: g.durationMin,
      emoji: g.emoji,
    });
  }

  const cats = repo.listQuizCategories();
  const catId = (name: string): number => {
    const found = cats.find((c) => String(c.name).toLowerCase() === name.toLowerCase());
    return found ? Number(found.id) : repo.createQuizCategory(name);
  };

  const isEmpty = repo.countQuizQuestions(null, false) === 0;
  for (const q of DEFAULT_QUESTIONS as QuizQuestion[]) {
    const cid = catId(q.category);
    if (isEmpty) {
      const id = repo.createQuizQuestion(cid, q.text, q.difficulty === 1 ? 'easy' : q.difficulty === 2 ? 'medium' : 'hard', q.correctIndex);
      repo.replaceQuizAnswers(id, q.answers);
    }
  }
}

if (import.meta.url === new URL(process.argv[1] ?? '', 'file://').href) {
  const cfg = loadConfig();
  const { db } = openDb(cfg.dbPath);
  const repo = new Repo(db);
  seedDefaults(repo);
  console.log(`[7gzone] seed ok: ${cfg.dbPath}`);
  process.exit(0);
}
