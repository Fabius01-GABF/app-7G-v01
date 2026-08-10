import { useEffect, useState } from 'react';
import { META } from '@shared/index';
import type { GameKind } from '@shared/index';
import { api } from '../lib/api';

interface Row {
  rank: number;
  user_id: number;
  username: string;
  avatar_emoji: string;
  avatar_color: string;
  xp: number;
  level: number;
  wins: number;
  games_played: number;
}

interface LB {
  rows: Row[];
  total: number;
  position: number | null;
}

export function LeaderboardScreen() {
  const [tab, setTab] = useState<GameKind | 'global'>('global');
  const [data, setData] = useState<LB | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    const path = tab === 'global' ? '/leaderboards/global' : `/leaderboards/games/${tab}`;
    api<LB>(`${path}?pageSize=50`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [tab]);

  return (
    <div className="screen fade-in">
      <h2>🏆 Classement</h2>
      <div className="segment" style={{ overflowX: 'auto' }}>
        <button className={tab === 'global' ? 'on' : ''} onClick={() => setTab('global')}>Global</button>
        {(Object.keys(META) as GameKind[]).map((k) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {META[k].emoji}
          </button>
        ))}
      </div>

      {data?.position != null && data.position > 0 && (
        <p className="pill" style={{ display: 'inline-block', marginBottom: 8 }}>
          Votre position : #{data.position}
        </p>
      )}

      {error && <p className="dim">{error}</p>}
      {!data && !error && <div className="spinner" />}

      {data && (
        <div className="card">
          {data.rows.length === 0 && <p className="dim">Aucun classement pour le moment.</p>}
          {data.rows.map((r) => (
            <div key={r.user_id} className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div className="row">
                <b style={{ width: 28, color: r.rank <= 3 ? 'var(--accent)' : undefined }}>{r.rank}</b>
                <div className="avatar" style={{ background: r.avatar_color }}>{r.avatar_emoji}</div>
                <span>{r.username}</span>
              </div>
              <span className="dim" style={{ fontSize: 13 }}>
                Niv. {r.level} · {r.xp} XP
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
