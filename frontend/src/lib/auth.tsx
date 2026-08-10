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
  login: (username: string) => Promise<Profile>;
  register: (username: string) => Promise<Profile>;
  logout: () => void;
  refresh: () => Promise<void>;
  setUser: (u: Profile) => void;
}

const Ctx = createContext<AuthState | null>(null);

const TOKEN_KEY = '7g.token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      setLoading(false);
      return;
    }
    setToken(t);
    api<{ user: Profile }>('/me')
      .then((r) => setUserState(r.user))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

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

  const login = async (username: string) => {
    const res = await api<{ token: string; user: Profile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setUserState(res.user);
    return res.user;
  };

  const register = async (username: string) => {
    const res = await api<{ token: string; user: Profile }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setUserState(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUserState(null);
  };

  const refresh = async () => {
    const res = await api<{ user: Profile }>('/me');
    setUserState(res.user);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh, setUser: setUserState }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
