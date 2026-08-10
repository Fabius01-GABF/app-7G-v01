import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { META } from '@shared/index';
import type { GameKind } from '@shared/index';
import { useAuth } from '../lib/auth';
import { OnlineSession, type PublicRoom, type GameStateMsg, type FinishedMsg } from '../lib/socket';
import { currentPlayerId } from '../lib/useLocalGame';
import type { ChessState, CheckersState, LudoState, UnoState, DominoState, QuizState } from '@shared/index';
import { ChessBoard } from '../games/chess/ChessBoard';
import { CheckersBoard } from '../games/checkers/CheckersBoard';
import { LudoBoard } from '../games/ludo/LudoBoard';
import { UnoBoard } from '../games/uno/UnoBoard';
import { DominoBoard } from '../games/domino/DominoBoard';
import { QuizBoard } from '../games/quiz/QuizBoard';

const ROOM_KEY = '7g.room';

export function OnlineScreen() {
  const { kind: kindParam } = useParams<{ kind: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const kind = (kindParam ?? 'chess') as GameKind;

  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [queued, setQueued] = useState(false);
  const [game, setGame] = useState<GameStateMsg | null>(null);
  const [finished, setFinished] = useState<FinishedMsg | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [matchMode, setMatchMode] = useState<'casual' | 'ranked'>('casual');

  const sessionRef = useRef<OnlineSession | null>(null);

  useEffect(() => {
    if (!user) return;
    const session = new OnlineSession(localStorage.getItem('7g.token') ?? '');
    sessionRef.current = session;

    session.onRoom = (r) => {
      setRoom(r);
      if (r.status === 'playing') {
        setFinished(null);
      } else {
        setGame(null);
        setFinished(null);
        setQueued(false);
        sessionStorage.removeItem(ROOM_KEY);
      }
    };
    session.onState = (m) => {
      setGame(m);
      setFinished(null);
      sessionStorage.setItem(ROOM_KEY, m.code);
    };
    session.onFinished = (m) => {
      setFinished(m);
      if (m.state) setGame({ code: m.code, state: m.state, seed: 0, yourSlot: m.yourSlot ?? null });
      setRoom((r) => (r ? { ...r, status: 'finished' } : r));
    };
    session.onQueued = () => {
      setQueued(true);
    };
    session.onPresence = () => {};
    session.onError = (msg) => setError(msg);

    const saved = sessionStorage.getItem(ROOM_KEY);
    if (saved) session.reconnect(saved);

    return () => {
      session.leave();
      sessionRef.current = null;
    };
  }, [user]);

  const nameMap = useMemo(() => {
    const m = new Map<number, string>();
    room?.players.forEach((p) => m.set(p.userId, p.username));
    return m;
  }, [room]);

  const label = (pid: string) => nameMap.get(Number(pid)) ?? pid;

  const copyCode = () => {
    if (!room) return;
    navigator.clipboard?.writeText(room.code).catch(() => {});
    setError('Code copié !');
  };

  // ---------- Lobby ----------
  if (queued) {
    return (
      <div className="screen fade-in">
        <div className="card center col">
          <div className="spinner" />
          <h3>Recherche d’adversaire…</h3>
          <p className="dim">{META[kind].name} · {matchMode === 'ranked' ? 'Classée' : 'Amicale'}</p>
          <button className="btn btn-ghost" onClick={() => { sessionRef.current?.cancelMatchmaking(); setQueued(false); }}>
            Annuler
          </button>
        </div>
      </div>
    );
  }

  if (room && room.status === 'lobby') {
    const isHost = room.hostId === user?.id;
    return (
      <div className="screen fade-in">
        <div className="card col">
          <div className="row-between">
            <h3>{META[kind].emoji} Salle {room.code}</h3>
            <span className="pill">{room.mode === 'ranked' ? '⭐ Classée' : room.mode === 'private' ? '🔒 Privée' : 'Amicale'}</span>
          </div>
          <p className="dim" style={{ fontSize: 13 }}>Partagez ce code à vos amis pour les inviter.</p>
          <button className="btn btn-ghost btn-block" onClick={copyCode}>📋 Copier le code</button>

          <div className="col mt">
            {room.players.map((p) => (
              <div key={p.userId} className="row-between">
                <div className="row">
                  <div className="avatar" style={{ background: p.avatar_color }}>{p.avatar_emoji}</div>
                  <span>
                    {p.username}
                    {p.userId === room.hostId ? ' 👑' : ''}
                    {p.userId === user?.id ? ' (vous)' : ''}
                  </span>
                </div>
                <span className={`pill${p.connected ? '' : ' dim'}`}>{p.connected ? 'Connecté' : 'Déconnecté'}</span>
              </div>
            ))}
          </div>

          {error && <p className="dim" style={{ fontSize: 13 }}>{error}</p>}

          <div className="row mt">
            {isHost ? (
              <button className="btn btn-primary btn-block" onClick={() => sessionRef.current?.startGame()}>
                ▶ Commencer
              </button>
            ) : (
              <button className="btn btn-ghost btn-block" onClick={() => navigate('/')} disabled>
                En attente de l’hôte…
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => navigate('/')}>Quitter</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Playing ----------
  if (game) {
    const state = game.state as { playerIds?: string[]; status?: string };
    const playerIds = state.playerIds ?? [];
    const playersLabel = playerIds.map(label);
    const acting = currentPlayerId(state);
    const mySlot = game.yourSlot;
    const canAct =
      mySlot != null &&
      acting != null &&
      acting === playerIds[mySlot] &&
      state.status !== 'finished' &&
      !finished;

    const base = {
      canAct,
      actions: [],
      meId: playerIds[mySlot ?? 0] ?? '',
      onAction: (a: unknown) => sessionRef.current?.sendAction(a),
      players: playersLabel,
      online: true,
    };

    const board = () => {
      switch (kind) {
        case 'chess':
          return <ChessBoard {...base} state={game.state as ChessState} />;
        case 'checkers':
          return <CheckersBoard {...base} state={game.state as CheckersState} />;
        case 'ludo':
          return <LudoBoard {...base} state={game.state as LudoState} />;
        case 'uno':
          return <UnoBoard {...base} state={game.state as UnoState} />;
        case 'domino':
          return <DominoBoard {...base} state={game.state as DominoState} />;
        case 'quiz':
          return <QuizBoard {...base} state={game.state as QuizState} />;
        default:
          return <p className="dim">Ce jeu n’est pas disponible en ligne.</p>;
      }
    };

    return (
      <div className="screen fade-in">
        <div className="topbar">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Quitter</button>
          <span className="title">{META[kind].emoji} {META[kind].name}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => sessionRef.current?.resign()}>🏳</button>
        </div>
        {board()}
        {finished && (
          <div className="card center mt col">
            <h3>
              {finished.you != null && finished.winner === String(finished.you) ? '🎉 Victoire !' : finished.winner === null ? '🤝 Égalité' : 'Partie terminée'}
            </h3>
            {finished.ranking.length > 0 && (
              <div className="col">
                {finished.ranking.map((pid, i) => (
                  <div key={pid} className="row-between" style={{ width: '100%' }}>
                    <span>{i + 1}. {label(pid)}</span>
                    <b>{pid === finished.winner ? '🏆' : ''}</b>
                  </div>
                ))}
              </div>
            )}
            {finished.reason && <p className="dim" style={{ fontSize: 13 }}>{finished.reason}</p>}
            <div className="row">
              <button className="btn btn-primary" onClick={() => sessionRef.current?.rematch()}>🔁 Revanche</button>
              <button className="btn btn-ghost" onClick={() => navigate('/')}>Quitter</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- Home (join/create) ----------
  return (
    <div className="screen fade-in">
      <div className="card center" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 44 }}>{META[kind].emoji}</div>
        <h1 style={{ margin: '4px 0 2px' }}>{META[kind].name}</h1>
        <p className="dim">Jouez en ligne contre d’autres joueurs.</p>
      </div>

      {error && <p className="dim center" style={{ fontSize: 13 }}>{error}</p>}

      <div className="card col">
        <label>Mode</label>
        <div className="segment">
          <button className={matchMode === 'casual' ? 'on' : ''} onClick={() => setMatchMode('casual')}>Amical</button>
          <button className={matchMode === 'ranked' ? 'on' : ''} onClick={() => setMatchMode('ranked')}>Classé ⭐</button>
        </div>
        <button
          className="btn btn-primary btn-block"
          onClick={() => sessionRef.current?.joinMatchmaking(kind, matchMode)}
        >
          🎲 Rechercher une partie
        </button>
        <div className="divider" />
        <label>Salle privée</label>
        <input
          placeholder="Code de la salle (ex : ABC123)"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
        />
        <button className="btn btn-block" onClick={() => sessionRef.current?.joinRoom(codeInput)} disabled={codeInput.trim().length === 0}>
          Rejoindre la salle
        </button>
        <button className="btn btn-ghost btn-block" onClick={() => sessionRef.current?.createRoom(kind, 'private')}>
          Créer une salle privée
        </button>
      </div>
    </div>
  );
}
