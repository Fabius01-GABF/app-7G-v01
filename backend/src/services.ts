import { randomUUID } from 'node:crypto';
import type { Config } from './config';
import type { Repo } from './repo';
import { hashPassword, verifyPassword, signToken, validateUsernameOnly, sanitize, type AuthUser } from './security';

export const levelFor = (xp: number): number => Math.floor(Math.sqrt(xp / 100)) + 1;

export const XP = { win: 100, draw: 40, loss: 10 } as const;

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function bad(message: string): never {
  throw new HttpError(400, 'BAD_REQUEST', message);
}

export function notFound(message: string): never {
  throw new HttpError(404, 'NOT_FOUND', message);
}

export function conflict(message: string): never {
  throw new HttpError(409, 'CONFLICT', message);
}

export function forbidden(message: string): never {
  throw new HttpError(403, 'FORBIDDEN', message);
}

export function unauthorized(message: string): never {
  throw new HttpError(401, 'UNAUTHORIZED', message);
}

export interface AuthResult {
  token: string;
  user: Record<string, unknown>;
}

export function registerUser(repo: Repo, cfg: Config, body: unknown): AuthResult {
  const v = validateUsernameOnly(body);
  if (!v.ok) bad(v.message);
  const b = body as Record<string, unknown>;
  const username = sanitize(b.username, 20);
  if (repo.findUserByUsername(username)) conflict('Ce pseudo est déjà pris.');
  const email = `${username.toLowerCase()}@app.local`;
  if (repo.findUserByEmail(email)) conflict('Cet email est déjà utilisé.');
  const hash = hashPassword(randomUUID());
  const userId = repo.createUser(username, email, hash);
  repo.createProfile(userId, null, null);
  const user = repo.findUserById(userId)!;
  return { token: signToken(cfg, { sub: String(user.id), username: String(user.username), role: String(user.role) }), user: publicProfile(repo, userId) };
}

export function loginUser(repo: Repo, cfg: Config, body: unknown): AuthResult {
  const b = body as Record<string, unknown>;
  const identifier = sanitize(b.identifier ?? b.username ?? '', 120);
  if (!identifier) bad('Pseudo requis.');
  const user = repo.findUserByIdentifier(identifier);
  if (!user) unauthorized('Pseudo introuvable.');
  if (Number(user.active) !== 1) forbidden('Compte désactivé.');
  repo.touchLastSeen(Number(user.id));
  return {
    token: signToken(cfg, { sub: String(user.id), username: String(user.username), role: String(user.role) }),
    user: publicProfile(repo, Number(user.id)),
  };
}

export function resetPassword(repo: Repo, cfg: Config, body: unknown): { message: string } {
  const b = body as Record<string, unknown>;
  const identifier = sanitize(b.identifier ?? '', 120);
  const answer = sanitize(b.security_answer ?? '', 200);
  const password = typeof b.new_password === 'string' ? b.new_password : '';
  if (password.length < 8) bad('Mot de passe : 8 caractères minimum.');
  const user = repo.findUserByIdentifier(identifier);
  if (!user) unauthorized('Compte introuvable.');
  const profile = repo.getProfile(Number(user.id));
  const hash = profile?.security_answer_hash as string | null;
  if (!hash || !verifyPassword(answer, hash)) forbidden('Réponse de sécurité incorrecte.');
  repo.updateUser(Number(user.id), { password_hash: hashPassword(password) });
  return { message: 'Mot de passe réinitialisé.' };
}

export function publicProfile(repo: Repo, userId: number): Record<string, unknown> {
  const p = repo.getProfile(userId);
  if (!p) throw new HttpError(404, 'NOT_FOUND', 'Profil introuvable.');
  const user = repo.findUserById(userId)!;
  return {
    id: userId,
    username: p.username,
    role: p.role,
    avatar_emoji: p.avatar_emoji,
    avatar_color: p.avatar_color,
    bio: p.bio,
    theme: p.theme,
    notifications_enabled: Number(p.notifications_enabled) === 1,
    xp: Number(p.xp),
    level: Number(p.level),
    wins: Number(p.wins),
    draws: Number(p.draws),
    losses: Number(p.losses),
    games_played: Number(p.games_played),
    badges: repo.countUserBadges(userId),
    stats_by_game: repo.getProfileStatsByGame(userId),
    last_seen_at: p.last_seen_at,
    created_at: user.created_at,
  };
}

export function getSelfProfile(repo: Repo, user: AuthUser): Record<string, unknown> {
  return publicProfile(repo, user.id);
}

export function updateProfile(repo: Repo, user: AuthUser, body: unknown): Record<string, unknown> {
  const b = body as Record<string, unknown>;
  const fields: Record<string, string | number> = {};
  if (typeof b.bio === 'string') fields.bio = sanitize(b.bio, 200);
  if (typeof b.avatar_emoji === 'string') fields.avatar_emoji = sanitize(b.avatar_emoji, 8);
  if (typeof b.avatar_color === 'string') fields.avatar_color = sanitize(b.avatar_color, 12);
  if (b.theme === 'light' || b.theme === 'dark' || b.theme === 'system') fields.theme = b.theme;
  if (typeof b.notifications_enabled === 'boolean') fields.notifications_enabled = b.notifications_enabled ? 1 : 0;
  if (Object.keys(fields).length === 0) bad('Aucun champ valide à mettre à jour.');
  repo.updateProfile(user.id, fields);
  return publicProfile(repo, user.id);
}

export function updateUsername(repo: Repo, user: AuthUser, body: unknown): Record<string, unknown> {
  const b = body as Record<string, unknown>;
  const username = sanitize(b.username ?? '', 20);
  if (!/^[a-zA-Z0-9_\-]{3,20}$/.test(username)) bad('Pseudo invalide (3-20 caractères).');
  const existing = repo.findUserByUsername(username);
  if (existing && Number(existing.id) !== user.id) conflict('Ce pseudo est déjà pris.');
  repo.setUsername(user.id, username);
  return publicProfile(repo, user.id);
}

export function listUsers(repo: Repo, query: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const rows = repo.listUsers(query, pageSize, offset).map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    active: u.active,
    last_seen_at: u.last_seen_at,
    created_at: u.created_at,
  }));
  return { rows, total: repo.countUsers(query), page, pageSize };
}

export function setUserActive(repo: Repo, admin: AuthUser, userId: number, active: boolean): Record<string, unknown> {
  if (admin.id === userId) forbidden('Impossible de désactiver votre propre compte.');
  const u = repo.findUserById(userId);
  if (!u) notFound('Utilisateur introuvable.');
  repo.updateUser(userId, { active: active ? 1 : 0 });
  repo.logAdmin(admin.id, 'user.set_active', { userId, active });
  return { id: userId, active };
}

export function setUserRole(repo: Repo, admin: AuthUser, userId: number, role: string): Record<string, unknown> {
  const allowed = ['player', 'moderator', 'editor', 'admin', 'super_admin'];
  if (!allowed.includes(role)) bad('Rôle invalide.');
  if (admin.id === userId) forbidden('Impossible de modifier votre propre rôle.');
  const u = repo.findUserById(userId);
  if (!u) notFound('Utilisateur introuvable.');
  repo.updateUser(userId, { role });
  repo.logAdmin(admin.id, 'user.set_role', { userId, role });
  return { id: userId, role };
}

export function adminDashboard(repo: Repo) {
  return {
    users: repo.countAllUsers(),
    matches: repo.countFinishedMatches(),
    online: repo.countUsersOnline(),
    avg_xp: repo.avgUserXp(),
    open_reports: repo.listReports('open', 50, 0).length,
  };
}

export function sendFriendRequest(repo: Repo, from: AuthUser, toId: number): Record<string, unknown> {
  if (from.id === toId) bad('Impossible de vous ajouter vous-même.');
  const target = repo.findUserById(toId);
  if (!target) notFound('Utilisateur introuvable.');
  if (Number(target.active) !== 1) bad('Ce compte est désactivé.');
  if (repo.areFriends(from.id, toId)) conflict('Vous êtes déjà amis.');
  if (repo.getActiveBan(toId)) forbidden('Compte banni.');
  const existing = repo.findPendingRequest(from.id, toId) ?? repo.findPendingRequest(toId, from.id);
  if (existing) conflict('Une demande est déjà en attente.');
  repo.sendFriendRequest(from.id, toId);
  repo.createNotification(toId, 'friend_request', 'Nouvelle demande d\'ami', `${from.username} souhaite être votre ami.`);
  return { sent: true, to: toId };
}

export function respondFriendRequest(repo: Repo, user: AuthUser, requestId: number, accept: boolean): Record<string, unknown> {
  const req = repo.getFriendRequest(requestId);
  if (!req) notFound('Demande introuvable.');
  if (Number(req.to_user) !== user.id) forbidden('Cette demande ne vous est pas adressée.');
  if (req.status !== 'pending') conflict('Demande déjà traitée.');
  repo.setFriendRequestStatus(requestId, accept ? 'accepted' : 'declined');
  if (accept) {
    repo.addFriendship(Number(req.from_user), user.id);
    const from = repo.findUserById(Number(req.from_user))!;
    repo.createNotification(Number(req.from_user), 'friend_accepted', 'Demande acceptée', `${user.username} a accepté votre demande.`);
    return { accepted: true, friend: { id: from.id, username: from.username } };
  }
  return { accepted: false };
}

export function listFriends(repo: Repo, user: AuthUser) {
  return repo.listFriends(user.id);
}

export function listFriendRequests(repo: Repo, user: AuthUser) {
  return repo.listFriendRequests(user.id);
}

export function removeFriend(repo: Repo, user: AuthUser, otherId: number): Record<string, unknown> {
  if (!repo.areFriends(user.id, otherId)) notFound('Relation introuvable.');
  repo.removeFriendship(user.id, otherId);
  return { removed: true };
}

export function blockUser(repo: Repo, user: AuthUser, otherId: number): Record<string, unknown> {
  if (user.id === otherId) bad('Impossible de vous bloquer vous-même.');
  repo.removeFriendship(user.id, otherId);
  const pending = repo.findPendingRequest(user.id, otherId) ?? repo.findPendingRequest(otherId, user.id);
  if (pending) repo.setFriendRequestStatus(Number(pending.id), 'blocked');
  repo.createNotification(otherId, 'blocked', 'Vous avez été bloqué', '');
  return { blocked: true };
}

export function listNotifications(repo: Repo, user: AuthUser, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const rows = repo.listNotifications(user.id, pageSize, offset).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    read: Number(n.read) === 1,
    created_at: n.created_at,
  }));
  return { rows, unread: repo.countUnreadNotifications(user.id), page, pageSize };
}

export function markNotificationRead(repo: Repo, user: AuthUser, id: number): Record<string, unknown> {
  if (!repo.markNotificationRead(user.id, id)) notFound('Notification introuvable.');
  return { read: true, unread: repo.countUnreadNotifications(user.id) };
}

export function markAllNotificationsRead(repo: Repo, user: AuthUser): Record<string, unknown> {
  repo.markAllNotificationsRead(user.id);
  return { read: true, unread: 0 };
}

export function dailyReward(repo: Repo, user: AuthUser): Record<string, unknown> {
  const state = repo.getDailyRewardState(user.id);
  const today = new Date().toISOString().slice(0, 10);
  if (state?.last_daily_reward_at === today) conflict('Récompense quotidienne déjà réclamée aujourd\'hui.');
  repo.setDailyRewardAt(user.id);
  const p = repo.getProfile(user.id)!;
  const newXp = Number(p.xp) + 25;
  repo.addXp(user.id, 25, 0, 0, 0, 0, levelFor(newXp));
  return { reward: { xp: 25 }, xp: newXp };
}

export function globalLeaderboard(repo: Repo, page: number, pageSize: number, userId: number) {
  const offset = (page - 1) * pageSize;
  const rows = repo.getLeaderboardGlobal(pageSize, offset).map((r, i) => ({
    rank: offset + i + 1,
    user_id: r.user_id,
    username: r.username,
    avatar_emoji: r.avatar_emoji,
    avatar_color: r.avatar_color,
    xp: r.xp,
    level: r.level,
    wins: r.wins,
    games_played: r.games_played,
  }));
  return { rows, total: repo.countAllUsers(), position: repo.getGlobalPosition(userId), page, pageSize };
}

export function gameLeaderboard(repo: Repo, game: string, page: number, pageSize: number, userId: number) {
  const offset = (page - 1) * pageSize;
  const rows = repo.getLeaderboardGame(game, pageSize, offset).map((r, i) => ({
    rank: offset + i + 1,
    user_id: r.user_id,
    username: r.username,
    avatar_emoji: r.avatar_emoji,
    avatar_color: r.avatar_color,
    wins: r.wins,
    games: r.games,
    xp: r.xp,
  }));
  return {
    rows,
    total: repo.getLeaderboardGame(game, 10000, 0).length,
    position: repo.getGamePosition(userId, game),
    page,
    pageSize,
  };
}

export function quizCategories(repo: Repo) {
  return repo.listQuizCategories();
}

export function quizQuestions(repo: Repo, categoryId: number | null, page: number, pageSize: number, includeAll: boolean) {
  const offset = (page - 1) * pageSize;
  const rows = repo.listQuizQuestions(categoryId, !includeAll, pageSize, offset).map((q) => ({
    id: q.id,
    category_id: q.category_id,
    category_name: q.category_name,
    text: q.text,
    difficulty: q.difficulty,
    correct_index: includeAll ? Number(q.correct_index) : undefined,
    answers: repo.listQuizAnswers(Number(q.id)).map((a) => a.text),
    enabled: Number(q.enabled) === 1,
  }));
  return { rows, total: repo.countQuizQuestions(categoryId, !includeAll), page, pageSize };
}

export function quizRandom(repo: Repo, count: number, categories: number[]) {
  const n = Math.min(Math.max(count, 1), 50);
  return repo.getRandomQuestions(n, categories);
}

export function createQuizCategory(repo: Repo, admin: AuthUser, body: unknown): Record<string, unknown> {
  const name = sanitize((body as Record<string, unknown>).name ?? '', 50);
  if (!name) bad('Nom de catégorie requis.');
  const id = repo.createQuizCategory(name);
  repo.logAdmin(admin.id, 'quiz.create_category', { id, name });
  return { id, name };
}

export function toggleQuizCategory(repo: Repo, admin: AuthUser, id: number, enabled: boolean): Record<string, unknown> {
  if (!repo.getQuizCategory(id)) notFound('Catégorie introuvable.');
  repo.setQuizCategoryEnabled(id, enabled);
  repo.logAdmin(admin.id, 'quiz.set_category_enabled', { id, enabled });
  return { id, enabled };
}

export function createQuizQuestion(repo: Repo, admin: AuthUser, body: unknown): Record<string, unknown> {
  const b = body as Record<string, unknown>;
  const text = sanitize(b.text ?? '', 300);
  const categoryId = Number(b.category_id ?? 0);
  const difficulty = ['easy', 'medium', 'hard'].includes(String(b.difficulty)) ? String(b.difficulty) : 'medium';
  const answers = Array.isArray(b.answers) ? (b.answers as unknown[]).filter((a): a is string => typeof a === 'string').map((a) => a.trim().slice(0, 200)) : [];
  const correctIndex = Number(b.correct_index ?? 0);
  if (!text) bad('Texte de question requis.');
  if (!repo.getQuizCategory(categoryId)) bad('Catégorie invalide.');
  if (answers.length < 2) bad('Au moins 2 réponses requises.');
  if (correctIndex < 0 || correctIndex >= answers.length) bad('Index de bonne réponse invalide.');
  const id = repo.createQuizQuestion(categoryId, text, difficulty, correctIndex);
  repo.replaceQuizAnswers(id, answers);
  repo.logAdmin(admin.id, 'quiz.create_question', { id, categoryId });
  return { id };
}

export function updateQuizQuestion(repo: Repo, admin: AuthUser, id: number, body: unknown): Record<string, unknown> {
  const q = repo.getQuizQuestion(id);
  if (!q) notFound('Question introuvable.');
  const b = body as Record<string, unknown>;
  const fields: Record<string, string | number> = {};
  if (typeof b.text === 'string' && b.text.trim()) fields.text = sanitize(b.text, 300);
  if (b.difficulty === 'easy' || b.difficulty === 'medium' || b.difficulty === 'hard') fields.difficulty = b.difficulty;
  if (typeof b.correct_index === 'number') {
    const answers = Array.isArray(b.answers) ? (b.answers as string[]) : repo.listQuizAnswers(id).map((a) => a.text as string);
    if (b.correct_index >= 0 && b.correct_index < answers.length) fields.correct_index = b.correct_index;
  }
  if (typeof b.enabled === 'boolean') fields.enabled = b.enabled ? 1 : 0;
  if (typeof b.category_id === 'number' && repo.getQuizCategory(b.category_id)) fields.category_id = b.category_id;
  repo.updateQuizQuestion(id, fields);
  if (Array.isArray(b.answers)) {
    const answers = (b.answers as unknown[]).filter((a): a is string => typeof a === 'string' && a.trim().length > 0).map((a) => a.trim().slice(0, 200));
    if (answers.length >= 2) repo.replaceQuizAnswers(id, answers);
  }
  repo.logAdmin(admin.id, 'quiz.update_question', { id });
  return { id, updated: true };
}

export function deleteQuizQuestion(repo: Repo, admin: AuthUser, id: number): Record<string, unknown> {
  if (!repo.getQuizQuestion(id)) notFound('Question introuvable.');
  repo.deleteQuizQuestion(id);
  repo.logAdmin(admin.id, 'quiz.delete_question', { id });
  return { deleted: true };
}

export function listReports(repo: Repo, user: AuthUser, status: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const rows = repo.listReports(status, pageSize, offset).map((r) => ({
    id: r.id,
    reporter_id: r.reporter_id,
    reporter_username: r.reporter_username,
    reported_user_id: r.reported_user_id,
    category: r.category,
    message: r.message,
    status: r.status,
    created_at: r.created_at,
  }));
  return { rows, page, pageSize };
}

export function createReport(repo: Repo, user: AuthUser, body: unknown): Record<string, unknown> {
  const b = body as Record<string, unknown>;
  const reportedUserId = typeof b.reported_user_id === 'number' ? b.reported_user_id : null;
  const category = sanitize(b.category ?? 'other', 50);
  const message = sanitize(b.message ?? '', 1000);
  if (reportedUserId && !repo.findUserById(reportedUserId)) notFound('Utilisateur signalé introuvable.');
  const id = repo.createReport(user.id, reportedUserId, category, message);
  return { id };
}

export function resolveReport(repo: Repo, user: AuthUser, id: number, status: string): Record<string, unknown> {
  if (status !== 'resolved' && status !== 'dismissed') bad('Statut invalide.');
  if (!repo.getReport(id)) notFound('Signalement introuvable.');
  repo.setReportStatus(id, status, user.id);
  repo.logAdmin(user.id, 'report.resolve', { id, status });
  return { id, status };
}

export function banUser(repo: Repo, user: AuthUser, body: unknown): Record<string, unknown> {
  const b = body as Record<string, unknown>;
  const userId = Number(b.user_id ?? 0);
  const reason = sanitize(b.reason ?? '', 500);
  if (!repo.findUserById(userId)) notFound('Utilisateur introuvable.');
  if (user.id === userId) forbidden('Impossible de bannir votre propre compte.');
  repo.updateUser(userId, { active: 0 });
  repo.createBan(userId, reason, user.id);
  repo.createNotification(userId, 'ban', 'Compte suspendu', reason || 'Vous avez été banni.');
  repo.logAdmin(user.id, 'user.ban', { userId, reason });
  return { banned: true, user_id: userId };
}

export function unbanUser(repo: Repo, user: AuthUser, userId: number): Record<string, unknown> {
  const ban = repo.getActiveBan(userId);
  if (!ban) notFound('Aucun bannissement actif.');
  repo.setBanActive(Number(ban.id), false);
  repo.updateUser(userId, { active: 1 });
  repo.logAdmin(user.id, 'user.unban', { userId });
  return { unbanned: true, user_id: userId };
}

export function listAdminLogs(repo: Repo, user: AuthUser, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const rows = repo.listAdminLogs(pageSize, offset).map((l) => ({
    id: l.id,
    admin_id: l.admin_id,
    admin_username: l.admin_username,
    action: l.action,
    details: l.details,
    created_at: l.created_at,
  }));
  return { rows, page, pageSize };
}

export function getSettings(repo: Repo) {
  const settings: Record<string, string> = {};
  for (const s of repo.listSettings()) settings[String(s.key)] = String(s.value);
  return settings;
}

export function setSetting(repo: Repo, user: AuthUser, key: string, value: unknown): Record<string, unknown> {
  if (!/^[a-z0-9_.-]{1,64}$/.test(key)) bad('Clé de paramètre invalide.');
  repo.setSetting(key, typeof value === 'string' ? value : JSON.stringify(value));
  repo.logAdmin(user.id, 'settings.set', { key });
  return { key, value };
}

export function setGameEnabled(repo: Repo, user: AuthUser, game: string, enabled: boolean): Record<string, unknown> {
  if (!repo.getGame(game)) notFound('Jeu introuvable.');
  repo.setGameEnabled(game, enabled);
  repo.logAdmin(user.id, 'games.set_enabled', { game, enabled });
  return { game, enabled };
}

export function setGameConfig(repo: Repo, user: AuthUser, game: string, config: Record<string, unknown>): Record<string, unknown> {
  if (!repo.getGame(game)) notFound('Jeu introuvable.');
  repo.setGameConfig(game, JSON.stringify(config));
  repo.logAdmin(user.id, 'games.set_config', { game });
  return { game, config };
}

export function recordMatch(
  repo: Repo,
  game: string,
  mode: string,
  players: Array<{ userId: number; slot: number; result: 'win' | 'draw' | 'loss' }>,
  winnerId: number | null,
  payload: Record<string, unknown>,
): number {
  const matchId = repo.createMatch(game, mode, winnerId, JSON.stringify(payload));
  for (const p of players) {
    repo.addMatchPlayer(matchId, p.userId, p.slot);
    const cur = repo.getLeaderboardEntry(p.userId, game);
    const wins = p.result === 'win' ? 1 : 0;
    const games = 1;
    const entryXp = wins ? XP.win : p.result === 'draw' ? XP.draw : XP.loss;
    repo.upsertLeaderboardEntry(p.userId, game, (cur ? Number(cur.wins) : 0) + wins, (cur ? Number(cur.games) : 0) + games, (cur ? Number(cur.xp) : 0) + entryXp);
    const prof = repo.getProfile(p.userId)!;
    const xpGain = wins ? XP.win + 10 : p.result === 'draw' ? XP.draw : XP.loss;
    repo.addXp(p.userId, xpGain, wins, p.result === 'draw' ? 1 : 0, p.result === 'loss' ? 1 : 0, 1, levelFor(Number(prof.xp) + xpGain));
    if (p.result === 'win') {
      repo.createNotification(p.userId, 'match_win', 'Victoire !', `Vous avez gagné une partie de ${game}.`);
    }
    grantBadges(repo, p.userId);
  }
  return matchId;
}

function grantBadges(repo: Repo, userId: number): void {
  const defs: Array<[string, string, string, string]> = [
    ['first_win', 'Première victoire', 'Gagnez votre première partie', '🏆'],
    ['ten_wins', 'Champion', 'Gagnez 10 parties', '🥇'],
    ['fifty_games', 'Vétéran', 'Jouez 50 parties', '🎖️'],
  ];
  for (const [code, name, desc, icon] of defs) repo.upsertBadge(code, name, desc, icon);
  const prof = repo.getProfile(userId)!;
  const badges = repo.listBadges();
  if (Number(prof.wins) >= 1) {
    const b = badges.find((x) => x.code === 'first_win')!;
    if (repo.awardBadge(userId, Number(b.id))) repo.createNotification(userId, 'badge', `Badge « ${b.name} »`, String(b.description));
  }
  if (Number(prof.wins) >= 10) {
    const b = badges.find((x) => x.code === 'ten_wins')!;
    if (repo.awardBadge(userId, Number(b.id))) repo.createNotification(userId, 'badge', `Badge « ${b.name} »`, String(b.description));
  }
  if (Number(prof.games_played) >= 50) {
    const b = badges.find((x) => x.code === 'fifty_games')!;
    if (repo.awardBadge(userId, Number(b.id))) repo.createNotification(userId, 'badge', `Badge « ${b.name} »`, String(b.description));
  }
}
