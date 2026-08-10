import { Router, type NextFunction, type Request, type Response } from 'express';
import type { Config } from './config';
import type { Repo } from './repo';
import * as svc from './services';
import { rateLimit, requireAuth, requireRole } from './security';

type Handler = (req: Request, res: Response) => Promise<void> | void;

function wrap(fn: Handler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (err) {
      next(err);
    }
  };
}

export function buildApiRouter(cfg: Config, repo: Repo): Router {
  const api = Router();

  const auth = requireAuth(cfg, repo);

  // ---- /auth ----
  api.post('/auth/register', rateLimit(cfg.rateLimitAuth, 60_000), wrap((req, res) => {
    res.status(201).json(svc.registerUser(repo, cfg, req.body));
  }));
  api.post('/auth/login', rateLimit(cfg.rateLimitAuth, 60_000), wrap((req, res) => {
    res.json(svc.loginUser(repo, cfg, req.body));
  }));
  api.post('/auth/reset-password', rateLimit(cfg.rateLimitAuth, 60_000), wrap((req, res) => {
    res.json(svc.resetPassword(repo, cfg, req.body));
  }));

  // ---- /me ----
  api.get('/me', auth, wrap((req, res) => {
    res.json({ user: svc.getSelfProfile(repo, req.authUser!) });
  }));

  // ---- /profiles ----
  api.patch('/profiles/me', auth, wrap((req, res) => {
    res.json({ user: svc.updateProfile(repo, req.authUser!, req.body) });
  }));
  api.patch('/profiles/me/username', auth, wrap((req, res) => {
    res.json({ user: svc.updateUsername(repo, req.authUser!, req.body) });
  }));

  // ---- /users ----
  api.get('/users', auth, requireRole('moderator'), wrap((req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(Math.max(1, Number(req.query.pageSize ?? 20)), 100);
    res.json(svc.listUsers(repo, String(req.query.q ?? ''), page, pageSize));
  }));
  api.patch('/users/:id/active', auth, requireRole('admin'), wrap((req, res) => {
    const active = Boolean(req.body.active);
    res.json(svc.setUserActive(repo, req.authUser!, Number(req.params.id), active));
  }));
  api.patch('/users/:id/role', auth, requireRole('admin'), wrap((req, res) => {
    res.json(svc.setUserRole(repo, req.authUser!, Number(req.params.id), String(req.body.role)));
  }));

  // ---- /games ----
  api.get('/games', wrap((req, res) => {
    res.json({ games: repo.getGames() });
  }));
  api.patch('/games/:id/enabled', auth, requireRole('admin'), wrap((req, res) => {
    res.json(svc.setGameEnabled(repo, req.authUser!, req.params.id, Boolean(req.body.enabled)));
  }));
  api.patch('/games/:id/config', auth, requireRole('admin'), wrap((req, res) => {
    res.json(svc.setGameConfig(repo, req.authUser!, req.params.id, (req.body.config ?? {}) as Record<string, unknown>));
  }));

  // ---- /matches ----
  api.get('/matches', auth, wrap((req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(Math.max(1, Number(req.query.pageSize ?? 20)), 100);
    const userId = req.authUser!.id;
    const offset = (page - 1) * pageSize;
    res.json({
      rows: repo.listMatchHistory(userId, pageSize, offset),
      total: repo.countMatchHistory(userId),
      page,
      pageSize,
    });
  }));
  api.get('/matches/:id', auth, wrap((req, res) => {
    const m = repo.getMatch(Number(req.params.id));
    if (!m) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Partie introuvable.' } });
      return;
    }
    const players = repo.listMatchPlayers(Number(m.id));
    const mine = players.some((p) => Number(p.user_id) === req.authUser!.id);
    if (!mine) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Accès refusé.' } });
      return;
    }
    res.json({ match: { ...m, players, moves: repo.listMatchMoves(Number(m.id)) } });
  }));

  // ---- /friends ----
  api.get('/friends', auth, wrap((req, res) => {
    res.json({ friends: svc.listFriends(repo, req.authUser!) });
  }));
  api.get('/friends/requests', auth, wrap((req, res) => {
    res.json({ requests: svc.listFriendRequests(repo, req.authUser!) });
  }));
  api.post('/friends/requests', auth, wrap((req, res) => {
    res.status(201).json(svc.sendFriendRequest(repo, req.authUser!, Number(req.body.user_id)));
  }));
  api.post('/friends/requests/:id/accept', auth, wrap((req, res) => {
    res.json(svc.respondFriendRequest(repo, req.authUser!, Number(req.params.id), true));
  }));
  api.post('/friends/requests/:id/decline', auth, wrap((req, res) => {
    res.json(svc.respondFriendRequest(repo, req.authUser!, Number(req.params.id), false));
  }));
  api.delete('/friends/:userId', auth, wrap((req, res) => {
    res.json(svc.removeFriend(repo, req.authUser!, Number(req.params.userId)));
  }));
  api.post('/friends/:userId/block', auth, wrap((req, res) => {
    res.json(svc.blockUser(repo, req.authUser!, Number(req.params.userId)));
  }));

  // ---- /leaderboards ----
  api.get('/leaderboards/global', auth, wrap((req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(Math.max(1, Number(req.query.pageSize ?? 20)), 100);
    res.json(svc.globalLeaderboard(repo, page, pageSize, req.authUser!.id));
  }));
  api.get('/leaderboards/games/:game', auth, wrap((req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(Math.max(1, Number(req.query.pageSize ?? 20)), 100);
    res.json(svc.gameLeaderboard(repo, req.params.game, page, pageSize, req.authUser!.id));
  }));

  // ---- /rewards ----
  api.post('/rewards/daily', auth, wrap((req, res) => {
    res.json(svc.dailyReward(repo, req.authUser!));
  }));
  api.get('/badges/me', auth, wrap((req, res) => {
    res.json({ badges: repo.listUserBadges(req.authUser!.id) });
  }));

  // ---- /notifications ----
  api.get('/notifications', auth, wrap((req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(Math.max(1, Number(req.query.pageSize ?? 20)), 50);
    res.json(svc.listNotifications(repo, req.authUser!, page, pageSize));
  }));
  api.post('/notifications/:id/read', auth, wrap((req, res) => {
    res.json(svc.markNotificationRead(repo, req.authUser!, Number(req.params.id)));
  }));
  api.post('/notifications/read-all', auth, wrap((req, res) => {
    res.json(svc.markAllNotificationsRead(repo, req.authUser!));
  }));

  // ---- /quiz ----
  api.get('/quiz/categories', auth, wrap((req, res) => {
    res.json({ categories: svc.quizCategories(repo) });
  }));
  api.get('/quiz/questions', auth, wrap((req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(Math.max(1, Number(req.query.pageSize ?? 20)), 100);
    const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
    const includeAll = req.query.include_all === 'true' && ['editor', 'admin', 'super_admin', 'moderator'].includes(req.authUser!.role);
    res.json(svc.quizQuestions(repo, categoryId, page, pageSize, includeAll));
  }));
  api.get('/quiz/random', auth, wrap((req, res) => {
    const count = Math.max(1, Number(req.query.count ?? 10));
    const categories = Array.isArray(req.query.categories)
      ? (req.query.categories as string[]).map(Number)
      : typeof req.query.categories === 'string' && req.query.categories.length > 0
        ? req.query.categories.split(',').map(Number)
        : [];
    res.json({ questions: svc.quizRandom(repo, count, categories) });
  }));
  api.post('/quiz/categories', auth, requireRole('editor'), wrap((req, res) => {
    res.status(201).json(svc.createQuizCategory(repo, req.authUser!, req.body));
  }));
  api.patch('/quiz/categories/:id/enabled', auth, requireRole('editor'), wrap((req, res) => {
    res.json(svc.toggleQuizCategory(repo, req.authUser!, Number(req.params.id), Boolean(req.body.enabled)));
  }));
  api.post('/quiz/questions', auth, requireRole('editor'), wrap((req, res) => {
    res.status(201).json(svc.createQuizQuestion(repo, req.authUser!, req.body));
  }));
  api.patch('/quiz/questions/:id', auth, requireRole('editor'), wrap((req, res) => {
    res.json(svc.updateQuizQuestion(repo, req.authUser!, Number(req.params.id), req.body));
  }));
  api.delete('/quiz/questions/:id', auth, requireRole('editor'), wrap((req, res) => {
    res.json(svc.deleteQuizQuestion(repo, req.authUser!, Number(req.params.id)));
  }));

  // ---- /reports ----
  api.post('/reports', auth, wrap((req, res) => {
    res.status(201).json(svc.createReport(repo, req.authUser!, req.body));
  }));
  api.get('/reports', auth, requireRole('moderator'), wrap((req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(Math.max(1, Number(req.query.pageSize ?? 20)), 100);
    res.json(svc.listReports(repo, req.authUser!, String(req.query.status ?? 'open'), page, pageSize));
  }));
  api.patch('/reports/:id/status', auth, requireRole('moderator'), wrap((req, res) => {
    res.json(svc.resolveReport(repo, req.authUser!, Number(req.params.id), String(req.body.status)));
  }));

  // ---- /admin ----
  api.get('/admin/dashboard', auth, requireRole('moderator'), wrap((req, res) => {
    res.json(svc.adminDashboard(repo));
  }));
  api.post('/admin/bans', auth, requireRole('moderator'), wrap((req, res) => {
    res.status(201).json(svc.banUser(repo, req.authUser!, req.body));
  }));
  api.post('/admin/bans/:userId/unban', auth, requireRole('moderator'), wrap((req, res) => {
    res.json(svc.unbanUser(repo, req.authUser!, Number(req.params.userId)));
  }));
  api.get('/admin/logs', auth, requireRole('super_admin'), wrap((req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(Math.max(1, Number(req.query.pageSize ?? 50)), 100);
    res.json(svc.listAdminLogs(repo, req.authUser!, page, pageSize));
  }));

  // ---- /settings ----
  api.get('/settings', wrap((req, res) => {
    res.json({ settings: svc.getSettings(repo) });
  }));
  api.put('/settings/:key', auth, requireRole('admin'), wrap((req, res) => {
    res.json(svc.setSetting(repo, req.authUser!, req.params.key, req.body.value));
  }));

  api.get('/health', wrap((_req, res) => {
    res.json({ ok: true, status: 'ok', time: new Date().toISOString() });
  }));

  api.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof svc.HttpError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
    console.error('[api]', err);
    return res.status(500).json({ error: { code: 'INTERNAL', message: 'Erreur interne.' } });
  });

  return api;
}
