import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getMeta, type AiDifficulty, type GameKind } from '@shared/index';

type Mode = 'solo' | 'local' | 'online';

export function GameHub() {
  const { kind } = useParams<{ kind: string }>();
  const navigate = useNavigate();
  const meta = getMeta(kind as GameKind);

  const [mode, setMode] = useState<Mode>('solo');
  const [players, setPlayers] = useState(2);
  const [difficulty, setDifficulty] = useState<AiDifficulty>('medium');
  const [topic, setTopic] = useState('all');

  const quizTopics = ['all', 'Science', 'Histoire', 'Géographie', 'Sport', 'Culture', 'Jeux vidéo'];

  if (!meta) {
    return (
      <div className="card center">
        <p>Jeu inconnu.</p>
        <Link to="/" className="btn btn-ghost">Retour</Link>
      </div>
    );
  }

  const playerOptions: number[] = [];
  for (let i = meta.minPlayers; i <= meta.maxPlayers; i++) playerOptions.push(i);
  if (mode === 'online') {
    const onlineMax = meta.online ? meta.maxPlayers : 0;
    for (let i = meta.minPlayers; i <= Math.max(meta.minPlayers, onlineMax); i++) {
      if (!playerOptions.includes(i)) playerOptions.push(i);
    }
  }

  const canOnline = meta.online;

  const go = () => {
    if (mode === 'online') {
      navigate(`/online/${kind}`);
      return;
    }
    navigate(`/play/${kind}?mode=${mode}&players=${players}&difficulty=${difficulty}&topic=${encodeURIComponent(topic)}`);
  };

  return (
    <div className="fade-in">
      <Link to="/" className="dim" style={{ textDecoration: 'none', fontSize: 13 }}>
        ← Tous les jeux
      </Link>
      <div className="card center mt" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 44 }}>{meta.emoji}</div>
        <h1 style={{ margin: '4px 0 2px' }}>{meta.name}</h1>
        <p className="dim">{meta.blurb}</p>
        <p className="pill" style={{ display: 'inline-block' }}>
          {meta.minPlayers}–{meta.maxPlayers} joueurs · ~{meta.durationMin} min
        </p>
      </div>

      <div className="card col">
        <div className="segment">
          <button className={mode === 'solo' ? 'on' : ''} onClick={() => { setMode('solo'); setPlayers(meta.minPlayers); }}>🤖 Solo</button>
          <button className={mode === 'local' ? 'on' : ''} onClick={() => { setMode('local'); setPlayers(meta.minPlayers); }}>👥 Local</button>
          <button
            className={mode === 'online' ? 'on' : ''}
            onClick={() => canOnline && setMode('online')}
            disabled={!canOnline}
            title={canOnline ? '' : 'Pas encore disponible en ligne'}
          >
            🌐 En ligne
          </button>
        </div>

        <div>
          <label>Joueurs</label>
          <select
            value={players}
            onChange={(e) => setPlayers(Number(e.target.value))}
            disabled={mode === 'online'}
          >
            {playerOptions.map((n) => (
              <option key={n} value={n}>
                {n} joueur{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>

        {mode !== 'online' && kind === 'quiz' && (
          <div>
            <label>Thème des questions</label>
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              {quizTopics.map((t) => (
                <option key={t} value={t}>
                  {t === 'all' ? 'Tous les thèmes' : t}
                </option>
              ))}
            </select>
          </div>
        )}

        {mode !== 'online' && (
          <div>
            <label>Niveau de l’IA</label>
            <div className="segment">
              <button className={difficulty === 'easy' ? 'on' : ''} onClick={() => setDifficulty('easy')}>Facile</button>
              <button className={difficulty === 'medium' ? 'on' : ''} onClick={() => setDifficulty('medium')}>Moyen</button>
              <button className={difficulty === 'hard' ? 'on' : ''} onClick={() => setDifficulty('hard')}>Difficile</button>
            </div>
          </div>
        )}

        <button className="btn btn-block" onClick={go} disabled={mode === 'online' && !canOnline}>
          {mode === 'online'
            ? canOnline
              ? 'Rejoindre l’en ligne'
              : 'Indisponible en ligne'
            : mode === 'solo'
              ? 'Jouer contre l’IA'
              : 'Commencer la partie'}
        </button>
      </div>
    </div>
  );
}
