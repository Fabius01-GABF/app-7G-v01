import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { openDb, type DbHandle } from './db';
import { Repo } from './repo';
import { seedDefaults } from './seed';
import { loadConfig } from './config';
import { createApp } from './app';
import { registerUser } from './services';

let handle: DbHandle;
let repo: Repo;
let app: ReturnType<typeof createApp>;
let cfg: ReturnType<typeof loadConfig>;

const PASSWORD = 'password-123';

before(() => {
  cfg = loadConfig({ JWT_SECRET: 'test-secret', RATE_LIMIT_AUTH: '1000' });
});

beforeEach(() => {
  handle = openDb(':memory:');
  repo = new Repo(handle.db);
  seedDefaults(repo);
  app = createApp(cfg, repo);
});

function register(username: string, email: string) {
  const res = registerUser(repo, cfg, {
    username,
    email,
    password: PASSWORD,
    security_question: 'Animal préféré ?',
    security_answer: 'chien',
  });
  return res as { token: string; user: { id: number; username: string } };
}

describe('api /health', () => {
  it('answers 200 with ok', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });
});

describe('api auth + RBAC', () => {
  it('registers and gets self profile with the token', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@test.dev', password: PASSWORD });
    assert.equal(reg.status, 201);
    assert.ok(reg.body.token.length > 20);

    const me = await request(app).get('/api/me').set('Authorization', `Bearer ${reg.body.token}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.user.username, 'alice');
  });

  it('rejects a wrong password with 401', async () => {
    register('bob', 'bob@test.dev');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'bob@test.dev', password: 'wrong-pass' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  it('requires auth on protected routes', async () => {
    const res = await request(app).get('/api/me');
    assert.equal(res.status, 401);
  });

  it('forbids a normal player from admin endpoints (403)', async () => {
    const player = register('carol', 'carol@test.dev');
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${player.token}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  it('lets a super admin use admin endpoints', async () => {
    const admin = register('root', 'root@test.dev');
    repo.setUserRole(admin.user.id, 'super_admin');
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${admin.token}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.users >= 1);
  });

  it('lets an admin change another user role', async () => {
    const admin = register('root2', 'root2@test.dev');
    const target = register('dave', 'dave@test.dev');
    repo.setUserRole(admin.user.id, 'admin');
    const res = await request(app)
      .patch(`/api/users/${target.user.id}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'editor' });
    assert.equal(res.status, 200);
    assert.equal(repo.findUserById(target.user.id)?.role, 'editor');
  });

  it('forbids a player from managing quiz questions (403)', async () => {
    const player = register('erin', 'erin@test.dev');
    const res = await request(app)
      .post('/api/quiz/questions')
      .set('Authorization', `Bearer ${player.token}`)
      .send({ categoryId: 1, text: 'x', answers: ['a', 'b', 'c', 'd'], correctIndex: 0 });
    assert.equal(res.status, 403);
  });
});
