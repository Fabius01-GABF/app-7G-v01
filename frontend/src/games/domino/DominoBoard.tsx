import { useState } from 'react';
import type { DominoState, DominoAction } from '@shared/index';
import { DOMINO_TILES } from '@shared/index';

interface Props {
  state: DominoState;
  canAct: boolean;
  actions: DominoAction[];
  meId: string;
  onAction: (a: DominoAction) => void;
  players: string[];
  online?: boolean;
}

function Tile({ a, b, rotate }: { a: number; b: number; rotate?: boolean }) {
  return (
    <span
      style={{
        display: 'flex',
        flexDirection: rotate ? 'column' : 'row',
        width: rotate ? 30 : 52,
        height: rotate ? 52 : 30,
        borderRadius: 6,
        background: '#fdf6e3',
        color: '#222',
        border: '1.5px solid #8d7b4b',
        boxShadow: '0 2px 3px rgba(0,0,0,.3)',
        overflow: 'hidden',
      }}
    >
      <span style={{ flex: 1, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14 }}>{a}</span>
      <span style={{ flex: 1, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14, borderLeft: '1px solid #8d7b4b', borderRight: rotate ? 'none' : '1px solid #8d7b4b' }}>
        {b}
      </span>
    </span>
  );
}

export function DominoBoard({ state, canAct, actions, meId, onAction, players }: Props) {
  const me = players.indexOf(meId);
  const myTurn = state.turn === me;
  const [pick, setPick] = useState<number | null>(null);

  const myHand = state.hands[me] ?? [];
  const playables = actions.filter((a) => a.type === 'play') as { type: 'play'; tile: number; end: 'left' | 'right' }[];
  const canDraw = actions.some((a) => a.type === 'draw');
  const canPass = actions.some((a) => a.type === 'pass');

  const tapTile = (i: number) => {
    if (!canAct || !myTurn) return;
    const plays = playables.filter((p) => p.tile === i);
    if (plays.length === 0) return;
    if (plays.length === 1) {
      onAction(plays[0]);
      return;
    }
    setPick(i);
  };

  const ends = pick !== null ? playables.filter((p) => p.tile === pick) : [];

  return (
    <div className="board-wrap">
      <div className="row-between">
        <div>
          <h3>7G Domino</h3>
          <span className="dim" style={{ fontSize: 13 }}>
            {state.status === 'finished'
              ? state.result
                ? `${state.result.winner} gagne !`
                : 'Terminé'
              : myTurn
                ? pick !== null
                  ? 'Où poser le domino ?'
                  : 'Jouez un domino'
                : `${players[state.turn]} joue…`}
          </span>
        </div>
        <span className="pill">Manche {state.round} · Tour {players[state.turn]}</span>
      </div>

      {pick !== null && ends.length > 0 && (
        <div className="card center">
          <h3>Poser à gauche ou à droite ?</h3>
          <div className="row" style={{ justifyContent: 'center' }}>
            {ends.some((e) => e.end === 'left') && (
              <button className="btn" onClick={() => { onAction(ends.find((e) => e.end === 'left')!); setPick(null); }}>
                ⬅ Gauche
              </button>
            )}
            {ends.some((e) => e.end === 'right') && (
              <button className="btn btn-ghost" onClick={() => { onAction(ends.find((e) => e.end === 'right')!); setPick(null); }}>
                Droite ➡
              </button>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 10 }}>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', minHeight: 58, alignItems: 'center', padding: '6px 0' }}>
          {state.chain.length === 0 && <span className="dim" style={{ fontSize: 13 }}>Le plateau est vide.</span>}
          {state.chain.map((t, i) => (
            <Tile key={i} a={t.a} b={t.b} rotate={state.chain.length > 12 && i % 3 === 0} />
          ))}
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <span className="pill">Gauche : {state.leftEnd ?? '—'}</span>
          <span className="pill">Droite : {state.rightEnd ?? '—'}</span>
          <span className="pill">Pioche : {state.boneyard.length}</span>
        </div>
      </div>

      <div className="card" style={{ padding: 8 }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', minHeight: 60, alignItems: 'center', padding: '6px 0' }}>
          {myHand.map((t, i) => {
            const tile = DOMINO_TILES[t];
            const playable = playables.some((p) => p.tile === i);
            return (
              <button
                key={i}
                onClick={() => tapTile(i)}
                disabled={!playable || !canAct || !myTurn}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  flex: '0 0 auto',
                  transform: playable && canAct && myTurn ? 'translateY(-4px)' : undefined,
                  filter: playable ? 'none' : 'grayscale(0.6)',
                }}
              >
                <Tile a={tile.a} b={tile.b} />
              </button>
            );
          })}
          {myHand.length === 0 && <span className="dim">Plus de domino</span>}
        </div>
        <div className="row mt">
          <button className="btn btn-ghost grow" onClick={() => onAction({ type: 'draw' })} disabled={!canDraw || !canAct || !myTurn}>
            Piocher
          </button>
          <button className="btn btn-ghost grow" onClick={() => onAction({ type: 'pass' })} disabled={!canPass || !canAct || !myTurn}>
            Passer
          </button>
        </div>
      </div>

      <div className="player-strip">
        {players.map((p, i) => (
          <span key={p} className={`pchip${state.turn === i && state.status !== 'finished' ? ' turn' : ''}`}>
            {p} · {(state.hands[i] ?? []).filter((x) => x !== null && x !== undefined).length} · {state.scores[i] ?? 0} pts
          </span>
        ))}
      </div>
    </div>
  );
}
