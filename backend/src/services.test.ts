import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, type DbHandle } from './db';
import { Repo } from './repo';
import { seedDefaults } from './seed';
import { loadConfig } from './config';
import {
  registerUser,
  loginUser,
  recordMatch,
  dailyReward,
  globalLeaderboard,
  quizQuestions,
  quizRandom,
  levelFor,
  HttpError,
} from './services';

let handle: DbHandle;
let repo: Repo;
let cfg: ReturnType<typeof loadConfig>;

const PASSWORD = 'password-123';

function makeUser(username: string, email: string) {
  return registerUser(repo, cfg, {
    username,
    email,
    password: PASSWORD,
    security_question: 'Animal préféré ?',
    security_answer: 'chien',
  });
}

function expectHttp(code: string, fn: () => unknown): void {
  try {
    fn();
    assert.fail(`expected HttpError ${code}`);
  } catch (err) {
    if (err instanceof HttpError) assert.equal(err.code, code);
    else throw err;
  }
}

before(() => {
  cfg = loadConfig({ JWT_SECRET: 'test-secret' });
});

beforeEach(() => {
  handle = openDb(':memory:');
  repo = new Repo(handle.db);
  seedDefaults(repo);
});

describe('auth', () => {
  it('registers a user and returns a token + profile', () => {
    const res = registerUser(repo, cfg, { username: 'alice', email: 'alice@test.dev', password: PASSWORD });
    assert.ok(res.token.length > 20);
    assert.equal(res.user.username, 'alice');
    assert.equal(res.user.xp, 0);
    assert.equal(res.user.level, 1);
  });

  it('rejects a duplicate username', () => {
    makeUser('bob', 'bob@test.dev');
    expectHttp('CONFLICT', () => registerUser(repo, cfg, { username: 'BOB', email: 'other@test.dev', password: PASSWORD }));
  });

  it('rejects an invalid email', () => {
    expectHttp('BAD_REQUEST', () => registerUser(repo, cfg, { username: 'carol', email: 'not-an-email', password: PASSWORD }));
  });

  it('rejects a too-short password', () => {
    expectHttp('BAD_REQUEST', () => registerUser(repo, cfg, { username: 'dave', email: 'dave@test.dev', password: 'short' }));
  });

  it('logs in with correct credentials and rejects wrong password', () => {
    makeUser('erin', 'erin@test.dev');
    const ok = loginUser(repo, cfg, { identifier: 'erin@test.dev', password: PASSWORD });
    assert.equal(ok.user.username, 'erin');
    expectHttp('UNAUTHORIZED', () => loginUser(repo, cfg, { identifier: 'erin@test.dev', password: 'wrong-pass' }));
  });
});

describe('xp & leaderboard', () => {
  it('computes levels with sqrt formula', () => {
    assert.equal(levelFor(0), 1);
    assert.equal(levelFor(99), 1);
    assert.equal(levelFor(100), 2);
    assert.equal(levelFor(900), 4);
  });

  it('records a match and grants XP, wins, leaderboard, badge and notification', () => {
    const a = makeUser('frank', 'frank@test.dev');
    const b = makeUser('grace', 'grace@test.dev');
    const matchId = recordMatch(
      repo,
      'chess',
      'ranked',
      [
        { userId: a.user.id as number, slot: 0, result: 'win' },
        { userId: b.user.id as number, slot: 1, result: 'loss' },
      ],
      a.user.id as number,
      { engine: 'chess' },
    );
    assert.ok(matchId > 0);

    const profA = repo.getProfile(a.user.id as number)!;
    assert.equal(Number(profA.xp), 110);
    assert.equal(Number(profA.wins), 1);
    assert.equal(Number(profA.games_played), 1);
    assert.equal(Number(profA.level), 2);

    const profB = repo.getProfile(b.user.id as number)!;
    assert.equal(Number(profB.xp), 10);
    assert.equal(Number(profB.losses), 1);

    const lb = globalLeaderboard(repo, 1, 10, a.user.id as number);
    assert.equal(lb.rows[0].username, 'frank');
    assert.equal(lb.rows[0].xp, 110);

    const badges = repo.listUserBadges(a.user.id as number);
    assert.ok(badges.some((x) => x.code === 'first_win'));

    const notifs = repo.listNotifications(a.user.id as number, 10, 0);
    assert.ok(notifs.some((n) => n.type === 'match_win'));
  });

  it('grants no win notification on a loss', () => {
    const a = makeUser('hank', 'hank@test.dev');
    recordMatch(repo, 'checkers', 'casual', [{ userId: a.user.id as number, slot: 0, result: 'loss' }], null, {});
    const notifs = repo.listNotifications(a.user.id as number, 10, 0);
    assert.ok(!notifs.some((n) => n.type === 'match_win'));
  });
});

describe('daily reward', () => {
  it('grants 25 XP once per day and rejects the second claim', () => {
    const u = makeUser('irene', 'irene@test.dev');
    const auth = { id: u.user.id as number, username: 'irene', role: 'player' as const };
    const res = dailyReward(repo, auth);
    assert.equal(res.xp, 25);
    expectHttp('CONFLICT', () => dailyReward(repo, auth));
  });
});

describe('quiz', () => {
  it('seeds categories and questions', () => {
    const cats = repo.listQuizCategories();
    assert.ok(cats.length >= 4);
    assert.ok(repo.countQuizQuestions(null, false) >= 20);
  });

  it('lists questions without leaking correct_index to players', () => {
    const q = quizQuestions(repo, null, 1, 10, false);
    assert.ok(q.rows.length > 0);
    assert.equal(q.rows[0].correct_index, undefined);
    assert.ok(q.rows[0].answers.length >= 2);
    assert.equal(q.total, repo.countQuizQuestions(null, false));
  });

  it('returns random questions only when enabled', () => {
    const rand = quizRandom(repo, 5, []);
    assert.equal(rand.length, 5);
    for (const q of rand) {
      assert.ok(q.answers.length >= 2);
      assert.equal(typeof q.correctIndex, 'number');
    }
  });
});
