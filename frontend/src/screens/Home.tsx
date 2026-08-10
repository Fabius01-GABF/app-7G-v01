import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GAMES, getMeta } from '@shared/index';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';

export function Home() {
  const { user, setUser } = useAuth();
  const [rewardMsg, setRewardMsg] = useState<string | null>(null);
  const [rewardErr, setRewardErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.level < 1) return;
  }, [user]);

  const claimDaily = async () => {
    setRewardErr(null);
    setRewardMsg(null);
    try {
      const res = await api<{ reward: { xp: number }; xp: number }>('/rewards/daily', { method: 'POST' });
      setRewardMsg(`+${res.reward.xp} XP récupérés !`);
      const me = await api<{ user: { xp: number; level: number } }>('/me');
      setUser({ ...user!, xp: me.user.xp, level: me.user.level });
    } catch (e) {
      setRewardErr(e instanceof Error ? e.message : 'Erreur.');
    }
  };

  return (
    <div className="fade-in">
      {user && (
        <div className="card row-between">
          <div className="col" style={{ gap: 2 }}>
            <h2 style={{ margin: 0 }}>Salut, {user.username} !</h2>
            <span className="dim">Niveau {user.level} · {user.xp} XP · {user.wins} victoires</span>
          </div>
          <button className="btn btn-gold" onClick={claimDaily} disabled={!!rewardMsg}>
            {rewardMsg ? '✓ Réclamé' : '🎁 +25 XP'}
          </button>
        </div>
      )}
      {rewardMsg && <div className="ok-box">{rewardMsg}</div>}
      {rewardErr && <div className="error-box">{rewardErr}</div>}

      <div className="row-between" style={{ marginBottom: 10 }}>
        <h2>Jeux</h2>
        <Link to="/admin" className="dim" style={{ fontSize: 13 }}>Admin</Link>
      </div>
      <div className="game-grid">
        {GAMES.filter((g) => g.id !== 'city').map((g) => (
          <GameTile key={g.id} id={g.id} />
        ))}
      </div>
      <div style={{ height: 12 }} />
      <div className="game-grid">
        <GameTile id="city" />
      </div>
    </div>
  );
}

function GameTile({ id }: { id: (typeof GAMES)[number]['id'] }) {
  const meta = getMeta(id);
  return (
    <Link to={`/game/${id}`} className="game-tile">
      <span className="g-emoji">{meta.emoji}</span>
      <span className="g-name">{meta.name}</span>
      <span className="g-blurb">{meta.blurb}</span>
    </Link>
  );
}
