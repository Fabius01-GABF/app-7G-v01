import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const MIGRATIONS: Array<{ version: number; name: string; up: (db: DatabaseSync) => void }> = [
  {
    version: 1,
    name: 'core',
    up(db) {
      db.exec(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE COLLATE NOCASE,
          email TEXT NOT NULL UNIQUE COLLATE NOCASE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player','moderator','editor','admin','super_admin')),
          avatar_emoji TEXT NOT NULL DEFAULT '🎮',
          avatar_color TEXT NOT NULL DEFAULT '#6c5ce7',
          active INTEGER NOT NULL DEFAULT 1,
          last_seen_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS profiles (
          user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          bio TEXT NOT NULL DEFAULT '',
          theme TEXT NOT NULL DEFAULT 'system',
          notifications_enabled INTEGER NOT NULL DEFAULT 1,
          security_question TEXT,
          security_answer_hash TEXT,
          xp INTEGER NOT NULL DEFAULT 0,
          level INTEGER NOT NULL DEFAULT 1,
          wins INTEGER NOT NULL DEFAULT 0,
          draws INTEGER NOT NULL DEFAULT 0,
          losses INTEGER NOT NULL DEFAULT 0,
          games_played INTEGER NOT NULL DEFAULT 0,
          last_daily_reward_at TEXT
        );

        CREATE TABLE IF NOT EXISTS games (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          min_players INTEGER NOT NULL,
          max_players INTEGER NOT NULL,
          solo INTEGER NOT NULL DEFAULT 0,
          local INTEGER NOT NULL DEFAULT 0,
          online INTEGER NOT NULL DEFAULT 0,
          duration_min INTEGER NOT NULL DEFAULT 10,
          emoji TEXT NOT NULL DEFAULT '🎮',
          enabled INTEGER NOT NULL DEFAULT 1,
          config TEXT NOT NULL DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS matches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          game TEXT NOT NULL REFERENCES games(id),
          mode TEXT NOT NULL DEFAULT 'casual' CHECK (mode IN ('casual','ranked','solo','local')),
          status TEXT NOT NULL DEFAULT 'playing' CHECK (status IN ('playing','finished','abandoned','cancelled')),
          winner_id INTEGER REFERENCES users(id),
          payload TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          finished_at TEXT
        );

        CREATE TABLE IF NOT EXISTS match_players (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id),
          player_slot INTEGER NOT NULL,
          score INTEGER NOT NULL DEFAULT 0,
          result TEXT CHECK (result IN ('win','draw','loss')),
          UNIQUE (match_id, player_slot),
          UNIQUE (match_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS match_moves (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
          player_slot INTEGER NOT NULL,
          action TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS rooms (
          id TEXT PRIMARY KEY,
          host_id INTEGER NOT NULL REFERENCES users(id),
          game TEXT NOT NULL REFERENCES games(id),
          mode TEXT NOT NULL DEFAULT 'private',
          status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','playing','closed')),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS friend_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          from_user INTEGER NOT NULL REFERENCES users(id),
          to_user INTEGER NOT NULL REFERENCES users(id),
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','blocked')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (from_user, to_user)
        );

        CREATE TABLE IF NOT EXISTS friendships (
          user_a INTEGER NOT NULL REFERENCES users(id),
          user_b INTEGER NOT NULL REFERENCES users(id),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (user_a, user_b),
          CHECK (user_a < user_b)
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL DEFAULT '',
          read INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS leaderboard_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          game TEXT NOT NULL REFERENCES games(id),
          user_id INTEGER NOT NULL REFERENCES users(id),
          wins INTEGER NOT NULL DEFAULT 0,
          games INTEGER NOT NULL DEFAULT 0,
          xp INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (game, user_id)
        );

        CREATE TABLE IF NOT EXISTS badges (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          icon TEXT NOT NULL DEFAULT '🏅'
        );

        CREATE TABLE IF NOT EXISTS user_badges (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
          earned_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (user_id, badge_id)
        );

        CREATE TABLE IF NOT EXISTS quiz_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          enabled INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS quiz_questions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER REFERENCES quiz_categories(id),
          text TEXT NOT NULL,
          difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
          correct_index INTEGER NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS quiz_answers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          question_id INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
          text TEXT NOT NULL,
          position INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reporter_id INTEGER NOT NULL REFERENCES users(id),
          reported_user_id INTEGER REFERENCES users(id),
          category TEXT NOT NULL DEFAULT 'other',
          message TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
          resolved_by INTEGER REFERENCES users(id),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS bans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id),
          reason TEXT NOT NULL DEFAULT '',
          banned_by INTEGER REFERENCES users(id),
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS admin_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          admin_id INTEGER REFERENCES users(id),
          action TEXT NOT NULL,
          details TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_matches_game ON matches(game);
        CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
        CREATE INDEX IF NOT EXISTS idx_match_players_user ON match_players(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
        CREATE INDEX IF NOT EXISTS idx_leaderboard_game_wins ON leaderboard_entries(game, wins DESC);
        CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
      `);
    },
  },
  {
    version: 2,
    name: 'matches-mode-private',
    up(db) {
      db.exec('PRAGMA legacy_alter_table = ON;');
      db.exec(`
        ALTER TABLE matches RENAME TO matches_old;
        CREATE TABLE matches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          game TEXT NOT NULL REFERENCES games(id),
          mode TEXT NOT NULL DEFAULT 'casual' CHECK (mode IN ('casual','ranked','solo','local','private')),
          status TEXT NOT NULL DEFAULT 'playing' CHECK (status IN ('playing','finished','abandoned','cancelled')),
          winner_id INTEGER REFERENCES users(id),
          payload TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          finished_at TEXT
        );
        INSERT INTO matches (id, game, mode, status, winner_id, payload, created_at, finished_at)
          SELECT id, game, mode, status, winner_id, payload, created_at, finished_at FROM matches_old;
        DROP TABLE matches_old;
        CREATE INDEX IF NOT EXISTS idx_matches_game ON matches(game);
        CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
      `);
      db.exec('PRAGMA legacy_alter_table = OFF;');
    },
  },
];

export interface DbHandle {
  db: DatabaseSync;
  close(): void;
}

function ensureDir(file: string): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
}

export function openDb(dbPath: string): DbHandle {
  if (dbPath !== ':memory:') ensureDir(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  migrate(db);
  return {
    db,
    close: () => db.close(),
  };
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const applied = new Set<number>(
    (db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>).map((r) => r.version),
  );
  const pending = MIGRATIONS.filter((m) => !applied.has(m.version));
  if (pending.length === 0) return;
  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    for (const m of pending) {
      const run = db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)');
      db.exec('BEGIN');
      try {
        m.up(db);
        run.run(m.version, m.name);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
}

export function publicUser(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    avatar_emoji: row.avatar_emoji,
    avatar_color: row.avatar_color,
    level: row.level,
    xp: row.xp,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    games_played: row.games_played,
    last_seen_at: row.last_seen_at,
    created_at: row.created_at,
  };
}
