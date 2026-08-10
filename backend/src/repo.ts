import type { DatabaseSync } from 'node:sqlite';

export class Repo {
  constructor(private db: DatabaseSync) {}

  getUserActive(id: number): boolean {
    const row = this.db.prepare('SELECT active FROM users WHERE id = ?').get(id) as { active: number } | undefined;
    return row ? row.active === 1 : false;
  }

  findUserById(id: number) {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  }

  findUserByUsername(username: string) {
    return this.db
      .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
      .get(username) as Record<string, unknown> | undefined;
  }

  findUserByEmail(email: string) {
    return this.db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email) as Record<string, unknown> | undefined;
  }

  findUserByIdentifier(identifier: string) {
    return this.db
      .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE')
      .get(identifier, identifier) as Record<string, unknown> | undefined;
  }

  createUser(username: string, email: string, hash: string): number {
    const res = this.db
      .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
      .run(username, email, hash);
    return Number(res.lastInsertRowid);
  }

  createProfile(userId: number, securityQuestion: string | null, securityAnswerHash: string | null): void {
    this.db
      .prepare(
        'INSERT INTO profiles (user_id, security_question, security_answer_hash) VALUES (?, ?, ?)',
      )
      .run(userId, securityQuestion, securityAnswerHash);
  }

  getProfile(userId: number) {
    return this.db
      .prepare(
        `SELECT p.*, u.username, u.role, u.avatar_emoji, u.avatar_color, u.last_seen_at, u.created_at, u.active
         FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = ?`,
      )
      .get(userId) as Record<string, unknown> | undefined;
  }

  updateProfile(userId: number, fields: Record<string, string | number>): void {
    const keys = Object.keys(fields);
    if (keys.length === 0) return;
    const sets = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => fields[k]);
    this.db.prepare(`UPDATE profiles SET ${sets}, updated_at = datetime('now') WHERE user_id = ?`).run(...values, userId);
  }

  updateUser(userId: number, fields: Record<string, string | number>): void {
    const keys = Object.keys(fields);
    if (keys.length === 0) return;
    const sets = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => fields[k]);
    this.db.prepare(`UPDATE users SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...values, userId);
  }

  touchLastSeen(userId: number): void {
    this.db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").run(userId);
  }

  setUsername(userId: number, username: string): boolean {
    const res = this.db.prepare('UPDATE users SET username = ?, updated_at = datetime(\'now\') WHERE id = ?').run(username, userId);
    return res.changes > 0;
  }

  listUsers(query: string, limit: number, offset: number) {
    const like = `%${query}%`;
    return this.db
      .prepare('SELECT * FROM users WHERE username LIKE ? OR email LIKE ? ORDER BY id LIMIT ? OFFSET ?')
      .all(like, like, limit, offset) as Record<string, unknown>[];
  }

  countUsers(query: string): number {
    const like = `%${query}%`;
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM users WHERE username LIKE ? OR email LIKE ?')
      .get(like, like) as { n: number };
    return Number(row.n);
  }

  countAllUsers(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
    return Number(row.n);
  }

  countFinishedMatches(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS n FROM matches WHERE status = 'finished'")
      .get() as { n: number };
    return Number(row.n);
  }

  countUsersOnline(): number {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM users WHERE last_seen_at >= ?').get(cutoff) as { n: number };
    return Number(row.n);
  }

  avgUserXp(): number {
    const row = this.db.prepare('SELECT AVG(xp) AS a FROM profiles').get() as { a: number | null };
    return Math.round(Number(row.a ?? 0));
  }

  getGames(): Record<string, unknown>[] {
    return this.db.prepare('SELECT * FROM games ORDER BY id').all() as Record<string, unknown>[];
  }

  getGame(id: string) {
    return this.db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  }

  upsertGame(g: {
    id: string;
    name: string;
    min_players: number;
    max_players: number;
    solo: number;
    local: number;
    online: number;
    duration_min: number;
    emoji: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO games (id, name, min_players, max_players, solo, local, online, duration_min, emoji, enabled, config)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, min_players=excluded.min_players,
           max_players=excluded.max_players, solo=excluded.solo, local=excluded.local,
           online=excluded.online, duration_min=excluded.duration_min, emoji=excluded.emoji`,
      )
      .run(
        g.id,
        g.name,
        g.min_players,
        g.max_players,
        g.solo,
        g.local,
        g.online,
        g.duration_min,
        g.emoji,
        1,
        '{}',
      );
  }

  setGameEnabled(id: string, enabled: boolean): void {
    this.db.prepare('UPDATE games SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
  }

  setGameConfig(id: string, config: string): void {
    this.db.prepare('UPDATE games SET config = ? WHERE id = ?').run(config, id);
  }

  createMatch(game: string, mode: string, winnerId: number | null, payload: string): number {
    const res = this.db
      .prepare('INSERT INTO matches (game, mode, status, winner_id, payload) VALUES (?, ?, \'finished\', ?, ?)')
      .run(game, mode, winnerId, payload);
    return Number(res.lastInsertRowid);
  }

  createMatchRow(game: string, mode: string): number {
    const res = this.db
      .prepare('INSERT INTO matches (game, mode) VALUES (?, ?)')
      .run(game, mode);
    return Number(res.lastInsertRowid);
  }

  setMatchStatus(id: number, status: string, winnerId: number | null): void {
    this.db
      .prepare("UPDATE matches SET status = ?, winner_id = ?, finished_at = datetime('now') WHERE id = ?")
      .run(status, winnerId, id);
  }

  setMatchPayload(id: number, payload: string): void {
    this.db.prepare('UPDATE matches SET payload = ? WHERE id = ?').run(payload, id);
  }

  addMatchPlayer(matchId: number, userId: number, slot: number): void {
    this.db
      .prepare('INSERT INTO match_players (match_id, user_id, player_slot) VALUES (?, ?, ?)')
      .run(matchId, userId, slot);
  }

  addMatchMove(matchId: number, slot: number, action: string): void {
    this.db.prepare('INSERT INTO match_moves (match_id, player_slot, action) VALUES (?, ?, ?)').run(matchId, slot, action);
  }

  getMatch(id: number) {
    return this.db.prepare('SELECT * FROM matches WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  }

  listMatchHistory(userId: number, limit: number, offset: number) {
    return this.db
      .prepare(
        `SELECT m.* FROM matches m
         JOIN match_players mp ON mp.match_id = m.id
         WHERE mp.user_id = ? AND m.status = 'finished'
         ORDER BY m.id DESC LIMIT ? OFFSET ?`,
      )
      .all(userId, limit, offset) as Record<string, unknown>[];
  }

  countMatchHistory(userId: number): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM matches m JOIN match_players mp ON mp.match_id = m.id
         WHERE mp.user_id = ? AND m.status = 'finished'`,
      )
      .get(userId) as { n: number };
    return Number(row.n);
  }

  listMatchPlayers(matchId: number) {
    return this.db
      .prepare(
        `SELECT mp.*, u.username, u.avatar_emoji, u.avatar_color FROM match_players mp
         JOIN users u ON u.id = mp.user_id WHERE mp.match_id = ? ORDER BY mp.player_slot`,
      )
      .all(matchId) as Record<string, unknown>[];
  }

  listMatchMoves(matchId: number) {
    return this.db.prepare('SELECT * FROM match_moves WHERE match_id = ? ORDER BY id').all(matchId) as Record<string, unknown>[];
  }

  sendFriendRequest(from: number, to: number): boolean {
    const res = this.db
      .prepare('INSERT INTO friend_requests (from_user, to_user) VALUES (?, ?)')
      .run(from, to);
    return res.changes > 0;
  }

  findPendingRequest(from: number, to: number) {
    return this.db
      .prepare("SELECT * FROM friend_requests WHERE from_user = ? AND to_user = ? AND status = 'pending'")
      .get(from, to) as Record<string, unknown> | undefined;
  }

  getFriendRequest(id: number) {
    return this.db.prepare('SELECT * FROM friend_requests WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  }

  setFriendRequestStatus(id: number, status: string): void {
    this.db.prepare('UPDATE friend_requests SET status = ? WHERE id = ?').run(status, id);
  }

  areFriends(a: number, b: number): boolean {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const row = this.db.prepare('SELECT 1 AS x FROM friendships WHERE user_a = ? AND user_b = ?').get(lo, hi);
    return Boolean(row);
  }

  addFriendship(a: number, b: number): void {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    this.db.prepare('INSERT INTO friendships (user_a, user_b) VALUES (?, ?)').run(lo, hi);
  }

  removeFriendship(a: number, b: number): void {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    this.db.prepare('DELETE FROM friendships WHERE user_a = ? AND user_b = ?').run(lo, hi);
  }

  listFriends(userId: number) {
    return this.db
      .prepare(
        `SELECT u.id, u.username, u.avatar_emoji, u.avatar_color, p.level, p.xp, u.last_seen_at
         FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END
         JOIN profiles p ON p.user_id = u.id
         WHERE f.user_a = ? OR f.user_b = ?
         ORDER BY u.username`,
      )
      .all(userId, userId, userId) as Record<string, unknown>[];
  }

  listFriendRequests(userId: number) {
    return this.db
      .prepare(
        `SELECT fr.id, fr.status, fr.created_at, u.id AS from_id, u.username AS from_username,
                u.avatar_emoji AS from_emoji, u.avatar_color AS from_color
         FROM friend_requests fr JOIN users u ON u.id = fr.from_user
         WHERE fr.to_user = ? AND fr.status = 'pending' ORDER BY fr.id DESC`,
      )
      .all(userId) as Record<string, unknown>[];
  }

  createNotification(userId: number, type: string, title: string, body: string): void {
    this.db.prepare('INSERT INTO notifications (user_id, type, title, body) VALUES (?, ?, ?, ?)').run(userId, type, title, body);
  }

  listNotifications(userId: number, limit: number, offset: number) {
    return this.db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?')
      .all(userId, limit, offset) as Record<string, unknown>[];
  }

  countUnreadNotifications(userId: number): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0')
      .get(userId) as { n: number };
    return Number(row.n);
  }

  markNotificationRead(userId: number, id: number): boolean {
    const res = this.db
      .prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND id = ?')
      .run(userId, id);
    return res.changes > 0;
  }

  markAllNotificationsRead(userId: number): void {
    this.db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId);
  }

  getLeaderboardGlobal(limit: number, offset: number) {
    return this.db
      .prepare(
        `SELECT p.user_id, u.username, u.avatar_emoji, u.avatar_color, p.xp, p.level, p.wins, p.games_played
         FROM profiles p JOIN users u ON u.id = p.user_id WHERE u.active = 1
         ORDER BY p.xp DESC, p.games_played ASC, u.username COLLATE NOCASE ASC
         LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as Record<string, unknown>[];
  }

  getGlobalPosition(userId: number): number {
    const row = this.db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM profiles p2 JOIN users u2 ON u2.id = p2.user_id
           WHERE u2.active = 1 AND (p2.xp > p.xp OR (p2.xp = p.xp AND p2.games_played < p.games_played))) + 1 AS pos
         FROM profiles p WHERE p.user_id = ?`,
      )
      .get(userId) as { pos: number };
    return Number(row.pos);
  }

  getLeaderboardGame(game: string, limit: number, offset: number) {
    return this.db
      .prepare(
        `SELECT le.user_id, u.username, u.avatar_emoji, u.avatar_color, le.wins, le.games, le.xp
         FROM leaderboard_entries le JOIN users u ON u.id = le.user_id WHERE le.game = ? AND u.active = 1
         ORDER BY le.wins DESC, le.games ASC, u.username COLLATE NOCASE ASC
         LIMIT ? OFFSET ?`,
      )
      .all(game, limit, offset) as Record<string, unknown>[];
  }

  getGamePosition(userId: number, game: string): number {
    const row = this.db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM leaderboard_entries le2 JOIN users u2 ON u2.id = le2.user_id
           WHERE le2.game = ? AND u2.active = 1
             AND (le2.wins > le.wins OR (le2.wins = le.wins AND le2.games < le.games))) + 1 AS pos
         FROM leaderboard_entries le WHERE le.user_id = ? AND le.game = ?`,
      )
      .get(game, userId, game) as { pos: number };
    return Number(row.pos);
  }

  getLeaderboardEntry(userId: number, game: string) {
    return this.db
      .prepare('SELECT * FROM leaderboard_entries WHERE user_id = ? AND game = ?')
      .get(userId, game) as Record<string, unknown> | undefined;
  }

  upsertLeaderboardEntry(userId: number, game: string, wins: number, games: number, xp: number): void {
    this.db
      .prepare(
        `INSERT INTO leaderboard_entries (game, user_id, wins, games, xp) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(game, user_id) DO UPDATE SET wins = excluded.wins, games = excluded.games,
           xp = excluded.xp, updated_at = datetime('now')`,
      )
      .run(game, userId, wins, games, xp);
  }

  addXp(userId: number, amount: number, wins: number, draws: number, losses: number, gamesPlayed: number, level: number): void {
    this.db
      .prepare(
        `UPDATE profiles SET xp = xp + ?, wins = wins + ?, draws = draws + ?, losses = losses + ?,
           games_played = games_played + ?, level = ? WHERE user_id = ?`,
      )
      .run(amount, wins, draws, losses, gamesPlayed, level, userId);
  }

  getProfileStatsByGame(userId: number) {
    return this.db
      .prepare(
        `SELECT le.game, le.wins, le.games, le.xp FROM leaderboard_entries le WHERE le.user_id = ? ORDER BY le.game`,
      )
      .all(userId) as Record<string, unknown>[];
  }

  getDailyRewardState(userId: number) {
    return this.db.prepare('SELECT last_daily_reward_at FROM profiles WHERE user_id = ?').get(userId) as
      | { last_daily_reward_at: string | null }
      | undefined;
  }

  setDailyRewardAt(userId: number): void {
    this.db.prepare("UPDATE profiles SET last_daily_reward_at = date('now') WHERE user_id = ?").run(userId);
  }

  listBadges() {
    return this.db.prepare('SELECT * FROM badges ORDER BY id').all() as Record<string, unknown>[];
  }

  getBadgeByCode(code: string) {
    return this.db.prepare('SELECT * FROM badges WHERE code = ?').get(code) as Record<string, unknown> | undefined;
  }

  upsertBadge(code: string, name: string, description: string, icon: string): void {
    this.db
      .prepare(
        `INSERT INTO badges (code, name, description, icon) VALUES (?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET name = excluded.name, description = excluded.description, icon = excluded.icon`,
      )
      .run(code, name, description, icon);
  }

  userHasBadge(userId: number, badgeId: number): boolean {
    const row = this.db.prepare('SELECT 1 AS x FROM user_badges WHERE user_id = ? AND badge_id = ?').get(userId, badgeId);
    return Boolean(row);
  }

  awardBadge(userId: number, badgeId: number): boolean {
    const res = this.db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)').run(userId, badgeId);
    return res.changes > 0;
  }

  listUserBadges(userId: number) {
    return this.db
      .prepare(
        `SELECT b.code, b.name, b.description, b.icon, ub.earned_at
         FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = ? ORDER BY ub.earned_at`,
      )
      .all(userId) as Record<string, unknown>[];
  }

  countUserBadges(userId: number): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM user_badges WHERE user_id = ?').get(userId) as { n: number };
    return Number(row.n);
  }

  listQuizCategories() {
    return this.db.prepare('SELECT * FROM quiz_categories ORDER BY name').all() as Record<string, unknown>[];
  }

  getQuizCategory(id: number) {
    return this.db.prepare('SELECT * FROM quiz_categories WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  }

  createQuizCategory(name: string): number {
    this.db.prepare('INSERT OR IGNORE INTO quiz_categories (name) VALUES (?)').run(name);
    const row = this.db.prepare('SELECT id FROM quiz_categories WHERE name = ?').get(name) as { id: number | bigint } | undefined;
    return row ? Number(row.id) : 0;
  }

  setQuizCategoryEnabled(id: number, enabled: boolean): void {
    this.db.prepare('UPDATE quiz_categories SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
  }

  countQuizQuestions(categoryId: number | null, enabledOnly: boolean, difficulty?: string): number {
    let sql = 'SELECT COUNT(*) AS n FROM quiz_questions q';
    const where: string[] = [];
    const params: Array<string | number> = [];
    if (categoryId !== null) {
      where.push('q.category_id = ?');
      params.push(categoryId);
    }
    if (enabledOnly) {
      where.push('q.enabled = 1');
      where.push('EXISTS (SELECT 1 FROM quiz_categories c WHERE c.id = q.category_id AND c.enabled = 1)');
    }
    if (difficulty) {
      where.push('q.difficulty = ?');
      params.push(difficulty);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    const row = this.db.prepare(sql).get(...params) as { n: number };
    return Number(row.n);
  }

  listQuizQuestions(categoryId: number | null, enabledOnly: boolean, limit: number, offset: number) {
    let sql = `SELECT q.*, c.name AS category_name FROM quiz_questions q
               LEFT JOIN quiz_categories c ON c.id = q.category_id`;
    const where: string[] = [];
    const params: Array<string | number> = [];
    if (categoryId !== null) {
      where.push('q.category_id = ?');
      params.push(categoryId);
    }
    if (enabledOnly) {
      where.push('q.enabled = 1');
      where.push('c.enabled = 1');
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY q.id LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }

  createQuizQuestion(categoryId: number, text: string, difficulty: string, correctIndex: number): number {
    const res = this.db
      .prepare('INSERT INTO quiz_questions (category_id, text, difficulty, correct_index) VALUES (?, ?, ?, ?)')
      .run(categoryId, text, difficulty, correctIndex);
    return Number(res.lastInsertRowid);
  }

  getQuizQuestion(id: number) {
    return this.db.prepare('SELECT * FROM quiz_questions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  }

  updateQuizQuestion(id: number, fields: Record<string, string | number>): void {
    const keys = Object.keys(fields);
    const sets = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => fields[k]);
    this.db.prepare(`UPDATE quiz_questions SET ${sets} WHERE id = ?`).run(...values, id);
  }

  deleteQuizQuestion(id: number): void {
    this.db.prepare('DELETE FROM quiz_questions WHERE id = ?').run(id);
  }

  addQuizAnswer(questionId: number, text: string, position: number): void {
    this.db.prepare('INSERT INTO quiz_answers (question_id, text, position) VALUES (?, ?, ?)').run(questionId, text, position);
  }

  replaceQuizAnswers(questionId: number, texts: string[]): void {
    this.db.prepare('DELETE FROM quiz_answers WHERE question_id = ?').run(questionId);
    texts.forEach((t, i) => this.addQuizAnswer(questionId, t, i));
  }

  listQuizAnswers(questionId: number) {
    return this.db
      .prepare('SELECT id, text, position FROM quiz_answers WHERE question_id = ? ORDER BY position')
      .all(questionId) as Record<string, unknown>[];
  }

  getRandomQuestions(count: number, categories: number[]) {
    const params: number[] = [count];
    let where = '';
    if (categories.length > 0) {
      where = ` AND q.category_id IN (${categories.map(() => '?').join(',')})`;
      params.push(...categories);
    }
    const rows = this.db
      .prepare(
        `SELECT q.id, q.category_id, q.text, q.difficulty, q.correct_index
         FROM quiz_questions q
         WHERE q.enabled = 1 AND EXISTS (SELECT 1 FROM quiz_categories c WHERE c.id = q.category_id AND c.enabled = 1)
           ${where}
         ORDER BY RANDOM() LIMIT ?`,
      )
      .all(...params) as Record<string, unknown>[];
    return rows.map((q) => ({
      id: q.id,
      categoryId: q.category_id,
      text: q.text,
      difficulty: q.difficulty,
      answers: this.listQuizAnswers(Number(q.id)).map((a) => a.text as string),
      correctIndex: Number(q.correct_index),
    }));
  }

  createReport(reporterId: number, reportedUserId: number | null, category: string, message: string): number {
    const res = this.db
      .prepare('INSERT INTO reports (reporter_id, reported_user_id, category, message) VALUES (?, ?, ?, ?)')
      .run(reporterId, reportedUserId, category, message);
    return Number(res.lastInsertRowid);
  }

  listReports(status: string, limit: number, offset: number) {
    return this.db
      .prepare(
        `SELECT r.*, u.username AS reporter_username FROM reports r
         JOIN users u ON u.id = r.reporter_id
         WHERE (? = 'all' OR r.status = ?) ORDER BY r.id DESC LIMIT ? OFFSET ?`,
      )
      .all(status, status, limit, offset) as Record<string, unknown>[];
  }

  getReport(id: number) {
    return this.db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  }

  setReportStatus(id: number, status: string, resolvedBy: number): void {
    this.db.prepare('UPDATE reports SET status = ?, resolved_by = ? WHERE id = ?').run(status, resolvedBy, id);
  }

  createBan(userId: number, reason: string, bannedBy: number): void {
    this.db.prepare('INSERT INTO bans (user_id, reason, banned_by) VALUES (?, ?, ?)').run(userId, reason, bannedBy);
  }

  getActiveBan(userId: number) {
    return this.db
      .prepare('SELECT * FROM bans WHERE user_id = ? AND active = 1')
      .get(userId) as Record<string, unknown> | undefined;
  }

  setBanActive(id: number, active: boolean): void {
    this.db.prepare('UPDATE bans SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
  }

  logAdmin(adminId: number, action: string, details: Record<string, unknown>): void {
    this.db.prepare('INSERT INTO admin_logs (admin_id, action, details) VALUES (?, ?, ?)').run(adminId, action, JSON.stringify(details));
  }

  listAdminLogs(limit: number, offset: number) {
    return this.db
      .prepare(
        `SELECT l.*, u.username AS admin_username FROM admin_logs l
         LEFT JOIN users u ON u.id = l.admin_id ORDER BY l.id DESC LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as Record<string, unknown>[];
  }

  getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value);
  }

  listSettings() {
    return this.db.prepare('SELECT * FROM settings ORDER BY key').all() as Record<string, unknown>[];
  }
}
