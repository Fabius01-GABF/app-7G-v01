import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setToken } from './api';

export interface Profile {
  id: number;
  username: string;
  role: string;
  avatar_emoji: string;
  avatar_color: string;
  bio: string;
  theme: 'light' | 'dark' | 'system';
  notifications_enabled: boolean;
  xp: number;
  level: number;
  wins: number;
  draws: number;
  losses: number;
  games_played: number;
  badges: number;
  stats_by_game: unknown[];
  last_seen_at: string | null;
  created_at: string;
}

interface AuthState {
  user: Profile | null;
  loading: boolean;
  retry: () => void;
  refresh: () => Promise<void>;
  setUser: (u: Profile) => void;
}

const Ctx = createContext<AuthState | null>(null);

const TOKEN_KEY = '7g.token';

function guestName(): string {
  return `Joueur-${Math.floor(10000 + Math.random() * 89999)}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    const boot = async () => {
      setLoading(true);
      const t = localStorage.getItem(TOKEN_KEY);
      if (t) {
        setToken(t);
        try {
          const r = await api<{ user: Profile }>('/me');
          if (alive) setUserState(r.user);
          return;
        } catch {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
      }
      for (let i = 0; i < 3; i++) {
        try {
          const r = await api<{ token: string; user: Profile }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username: guestName() }),
          });
          localStorage.setItem(TOKEN_KEY, r.token);
          setToken(r.token);
          if (alive) setUserState(r.user);
          return;
        } catch {
          // pseudo peut-être déjà pris ou réseau indisponible → nouvel essai
        }
      }
      if (alive) setUserState(null);
    };
    void boot().finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [nonce]);

  useEffect(() => {
    const theme = user?.theme ?? 'system';
    const apply = () => {
      const dark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [user?.theme]);

  const retry = () => setNonce((n) => n + 1);

  const refresh = async () => {
    const res = await api<{ user: Profile }>('/me');
    setUserState(res.user);
  };

  return (
    <Ctx.Provider value={{ user, loading, retry, refresh, setUser: setUserState }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
