import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { api } from './lib/api';
import { AuthScreen } from './screens/AuthScreen';
import { Home } from './screens/Home';
import { GameHub } from './screens/GameHub';
import { PlayScreen } from './screens/PlayScreen';
import { OnlineScreen } from './screens/OnlineScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { AdminScreen } from './screens/AdminScreen';

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const loc = useLocation();

  useEffect(() => {
    let alive = true;
    api<{ unread: number }>('/notifications?pageSize=1')
      .then((r) => alive && setUnread(r.unread))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [loc.pathname]);

  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="logo" style={{ textDecoration: 'none', color: 'inherit' }}>
          7G<b>Zone</b>
        </NavLink>
        <div className="row">
          {user && (
            <span className="pill">Niv. {user.level} · {user.xp} XP</span>
          )}
          {user && (
            <NavLink to="/profile" aria-label="Profil">
              <div
                className="avatar"
                style={{ background: user.avatar_color, borderColor: 'transparent' }}
              >
                {user.avatar_emoji}
              </div>
            </NavLink>
          )}
          {user && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={logout}
              aria-label="Déconnexion"
            >
              ⌁
            </button>
          )}
        </div>
      </header>

      <main className="container">{children}</main>

      <nav className="bottombar">
        <NavLink to="/" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="ico">🎮</span>Jeux
        </NavLink>
        <NavLink to="/leaderboard" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="ico">🏆</span>Classement
        </NavLink>
        <NavLink to="/notifications" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} style={{ position: 'relative' }}>
          <span className="ico">🔔</span>Alertes
          {unread > 0 && <span className="badge-dot">{unread > 9 ? '9+' : unread}</span>}
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="ico">⚙️</span>Réglages
        </NavLink>
      </nav>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<AuthScreen />} />
      </Routes>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:kind" element={<GameHub />} />
        <Route path="/play/:kind" element={<PlayScreen />} />
        <Route path="/online/:kind" element={<OnlineScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/leaderboard" element={<LeaderboardScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/notifications" element={<NotificationsScreen />} />
        <Route path="/admin" element={<AdminScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
