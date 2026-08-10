import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { META, defaultQuizQuestions } from '@shared/index';
import type {
  GameKind,
  ChessState,
  ChessMove,
  CheckersState,
  CheckersMove,
  LudoState,
  LudoAction,
  UnoState,
  UnoAnyAction,
  DominoState,
  DominoAction,
  QuizState,
  CityState,
} from '@shared/index';
import { useLocalGame } from '../lib/useLocalGame';
import { ChessBoard } from '../games/chess/ChessBoard';
import { CheckersBoard } from '../games/checkers/CheckersBoard';
import { LudoBoard } from '../games/ludo/LudoBoard';
import { UnoBoard } from '../games/uno/UnoBoard';
import { DominoBoard } from '../games/domino/DominoBoard';
import { QuizBoard } from '../games/quiz/QuizBoard';
import { CityBoard } from '../games/city/CityBoard';

export function PlayScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { kind: kindParam } = useParams<{ kind: string }>();
  const [search] = useSearchParams();
  const s = (location.state ?? {}) as Partial<{
    kind: GameKind;
    mode: 'solo' | 'local';
    count: number;
    difficulty: 'easy' | 'medium' | 'hard';
    topic?: string;
  }>;
  const kind: GameKind = (s.kind ?? kindParam ?? 'chess') as GameKind;
  const mode = (s.mode ?? search.get('mode') ?? 'solo') as 'solo' | 'local';
  const minPlayers = META[kind].minPlayers;
  const maxPlayers = META[kind].maxPlayers;
  const count = Math.max(minPlayers, Math.min(maxPlayers, Number(s.count ?? search.get('players') ?? minPlayers)));
  const difficulty = (s.difficulty ?? search.get('difficulty') ?? 'medium') as 'easy' | 'medium' | 'hard';
  const topic = s.topic ?? search.get('topic') ?? 'all';

  const players = useMemo(() => {
    if (mode === 'solo') return ['Vous', ...Array.from({ length: count - 1 }, (_, i) => `IA ${i + 1}`)];
    return Array.from({ length: count }, (_, i) => `Joueur ${i + 1}`);
  }, [mode, count]);

  const config = useMemo(() => {
    if (kind === 'quiz') {
      const pool = topic && topic !== 'all' ? defaultQuizQuestions.filter((q) => q.category === topic) : defaultQuizQuestions;
      const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, 8);
      return { playerIds: players, questions: picked };
    }
    return { playerIds: players };
  }, [kind, players, topic]);

  const [session, setSession] = useState(0);
  const [showControls, setShowControls] = useState(false);

  return (
    <div className="screen">
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          ← Quitter
        </button>
        <span className="title">{META[kind].emoji} {META[kind].name}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowControls((v) => !v)}>
          ⚙
        </button>
      </div>
      {showControls && (
        <div className="card">
          <div className="row gap-sm">
            <button
              className="btn btn-ghost"
              onClick={() => {
                setSession((v) => v + 1);
                setShowControls(false);
              }}
            >
              🔄 Recommencer
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/')}>
              🏠 Accueil
            </button>
          </div>
        </div>
      )}
      <GameInner key={session} kind={kind} mode={mode} players={players} config={config} difficulty={difficulty} />
    </div>
  );
}

function GameInner({
  kind,
  mode,
  players,
  config,
  difficulty,
}: {
  kind: GameKind;
  mode: 'solo' | 'local';
  players: string[];
  config: unknown;
  difficulty: 'easy' | 'medium' | 'hard';
}) {
  const game = useLocalGame(kind, mode, { playerIds: players, difficulty, config });
  const meId = game.actingId ?? players[0];
  const canAct = game.humanActing && !game.finished;

  const board = () => {
    const base = { canAct, meId, onAction: game.apply, players };
    switch (kind) {
      case 'chess':
        return <ChessBoard {...base} state={game.state as ChessState} actions={game.actions as ChessMove[]} />;
      case 'checkers':
        return <CheckersBoard {...base} state={game.state as CheckersState} actions={game.actions as CheckersMove[]} />;
      case 'ludo':
        return <LudoBoard {...base} state={game.state as LudoState} actions={game.actions as LudoAction[]} />;
      case 'uno':
        return <UnoBoard {...base} state={game.state as UnoState} actions={game.actions as UnoAnyAction[]} />;
      case 'domino':
        return <DominoBoard {...base} state={game.state as DominoState} actions={game.actions as DominoAction[]} />;
      case 'quiz':
        return <QuizBoard {...base} state={game.state as QuizState} actions={game.actions} />;
      case 'city':
        return <CityBoard {...base} state={game.state as CityState} actions={game.actions} />;
      default:
        return null;
    }
  };

  return (
    <div>
      {board()}
      {game.finished && (
        <div className="card mt center">
          <b>Partie terminée</b>
        </div>
      )}
    </div>
  );
}
