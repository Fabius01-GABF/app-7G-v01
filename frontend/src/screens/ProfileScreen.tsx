import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { META } from '@shared/index';
import type { GameKind } from '@shared/index';

interface Badge {
  id: number;
  code: string;
  name: string;
  description: string;
  emoji: string;
}

interface MatchRow {
  id: number;
  game: string;
  mode: string;
  result: string;
  rank: number;
  xp_gained: number;
  played_at: string;
}

export function ProfileScreen() {
  const { user } = useAuth();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);

  useEffect(() => {
    api<{ badges: Badge[] }>('/badges/me')
      .then((r) => setBadges(r.badges))
      .catch(() => {});
    api<{ rows: MatchRow[] }>('/matches?pageSize=10')
      .then((r) => setMatches(r.rows))
      .catch(() => {});
  }, []);

  if (!user) return null;

  return (
    <div className="screen fade-in">
      <div className="card center col">
        <div className="avatar" style={{ width: 72, height: 72, fontSize: 36, background: user.avatar_color }}>
          {user.avatar_emoji}
        </div>
        <h2 style={{ margin: '8px 0 0' }}>{user.username}</h2>
        {user.bio && <p className="dim" style={{ margin: 0 }}>{user.bio}</p>}
        <p className="pill">Niveau {user.level} · {user.xp} XP</p>
        <p className="dim" style={{ fontSize: 12 }}>Inscrit le {new Date(user.created_at).toLocaleDateString('fr-FR')}</p>
      </div>

      <div className="card">
        <h4>Statistiques</h4>
        <div className="stats-grid">
          <div className="stat"><b>{user.games_played}</b><span>Parties</span></div>
          <div className="stat"><b>{user.wins}</b><span>Victoires</span></div>
          <div className="stat"><b>{user.draws}</b><span>Nuls</span></div>
          <div className="stat"><b>{user.losses}</b><span>Défaites</span></div>
        </div>
      </div>

      <div className="card">
        <h4>Badges ({badges.length})</h4>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {badges.length === 0 && <p className="dim">Aucun badge pour l’instant.</p>}
          {badges.map((b) => (
            <span key={b.id} className="pill" title={b.description}>
              {b.emoji} {b.name}
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        <h4>Dernières parties</h4>
        {matches.length === 0 && <p className="dim">Aucune partie jouée.</p>}
        {matches.map((m) => (
          <div key={m.id} className="row-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span>{META[m.game as GameKind]?.emoji ?? '🎮'} {META[m.game as GameKind]?.name ?? m.game}</span>
            <span className="dim" style={{ fontSize: 12 }}>
              {m.result === 'win' ? '✅' : m.result === 'draw' ? '🤝' : '❌'} {m.xp_gained > 0 ? `+${m.xp_gained} XP` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
