import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { Config } from './config';

export interface TokenPayload {
  sub: string;
  username: string;
  role: string;
}

const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function signToken(cfg: Config, payload: TokenPayload): string {
  return jwt.sign(payload, cfg.jwtSecret, { expiresIn: cfg.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
}

export function verifyToken(cfg: Config, token: string): TokenPayload | null {
  try {
    return jwt.verify(token, cfg.jwtSecret) as TokenPayload;
  } catch {
    return null;
  }
}

export interface AuthUser {
  id: number;
  username: string;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

const ROLES: Record<string, number> = {
  player: 0,
  moderator: 1,
  editor: 2,
  admin: 3,
  super_admin: 4,
};

export function requireAuth(cfg: Config) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Token manquant.' } });
    }
    const payload = verifyToken(cfg, header.slice(7));
    if (!payload) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Token invalide ou expiré.' } });
    }
    req.authUser = { id: Number(payload.sub), username: payload.username, role: payload.role };
    return next();
  };
}

export function requireRole(minRole: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const u = req.authUser;
    if (!u) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Non authentifié.' } });
    if ((ROLES[u.role] ?? 0) < (ROLES[minRole] ?? 0)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Permissions insuffisantes.' } });
    }
    return next();
  };
}

export function requireActive(db: { getUserActive: (id: number) => boolean }) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.authUser && !db.getUserActive(req.authUser.id)) {
      return res.status(403).json({ error: { code: 'ACCOUNT_DISABLED', message: 'Compte désactivé.' } });
    }
    return next();
  };
}

export function rateLimit(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > limit) {
      return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Trop de requêtes. Réessayez plus tard.' } });
    }
    return next();
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_\-]{3,20}$/;

export function validateRegistration(body: unknown): { ok: true } | { ok: false; message: string } {
  if (!body || typeof body !== 'object') return { ok: false, message: 'Corps de requête invalide.' };
  const b = body as Record<string, unknown>;
  if (typeof b.username !== 'string' || !USERNAME_RE.test(b.username)) {
    return { ok: false, message: 'Pseudo invalide (3-20 caractères, lettres/chiffres/_/-).' };
  }
  if (typeof b.email !== 'string' || !EMAIL_RE.test(b.email)) {
    return { ok: false, message: 'Email invalide.' };
  }
  if (typeof b.password !== 'string' || b.password.length < 8) {
    return { ok: false, message: 'Mot de passe : 8 caractères minimum.' };
  }
  return { ok: true };
}

export function sanitize(v: unknown, maxLen: number): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, maxLen);
}
