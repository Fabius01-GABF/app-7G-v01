import { useState } from 'react';
import type { UnoState, UnoAnyAction, UnoColor } from '@shared/index';
import { cardLabel } from '@shared/index';

type UnoPlayAction = Extract<UnoAnyAction, { type: 'play' }>;

interface Props {
  state: UnoState;
  canAct: boolean;
  actions: UnoAnyAction[];
  meId: string;
  onAction: (a: UnoAnyAction) => void;
  players: string[];
  online?: boolean;
}

const COLOR_HEX: Record<UnoColor, string> = { r: '#e74c3c', y: '#f1c40f', g: '#2ecc71', b: '#54a0ff' };
const COLOR_LABEL: Record<UnoColor, string> = { r: 'Rouge', y: 'Jaune', g: 'Vert', b: 'Bleu' };

function CardFace({ card, small }: { card: { color: UnoColor | null; value: number | string }; small?: boolean }) {
  if (card.color === null) {
    return (
      <span
        style={{
          width: small ? 26 : 34,
          height: small ? 38 : 50,
          borderRadius: 6,
          display: 'grid',
          placeItems: 'center',
          background: 'linear-gradient(135deg,#e74c3c 25%,#f1c40f 0 50%,#2ecc71 0 75%,#54a0ff 0)',
          color: '#fff',
          fontSize: small ? 10 : 13,
          fontWeight: 800,
          border: '2px solid #fff',
          boxShadow: '0 2px 4px rgba(0,0,0,.35)',
        }}
      >
        {card.value === 'wild4' ? '+4' : 'W'}
      </span>
    );
  }
  const label =
    typeof card.value === 'number' ? String(card.value) : card.value === 'wild' ? 'W' : card.value === 'wild4' ? '+4' : card.value.toUpperCase();
  return (
    <span
      style={{
        width: small ? 26 : 34,
        height: small ? 38 : 50,
        borderRadius: 6,
        display: 'grid',
        placeItems: 'center',
        background: COLOR_HEX[card.color],
        color: card.color === 'y' ? '#222' : '#fff',
        fontSize: small ? 10 : 13,
        fontWeight: 800,
        border: '2px solid rgba(255,255,255,.85)',
        boxShadow: '0 2px 4px rgba(0,0,0,.35)',
      }}
    >
      {label}
    </span>
  );
}

export function UnoBoard({ state, canAct, actions, meId, onAction, players }: Props) {
  const me = players.indexOf(meId);
  const myTurn = state.turn === me;
  const [colorPick, setColorPick] = useState<number | null>(null);

  const playables = actions.filter((a): a is UnoPlayAction => a.type === 'play');
  const canDraw = actions.some((a) => a.type === 'draw');
  const myHand = state.hands[me] ?? [];

  const tapCard = (i: number) => {
    if (!canAct || !myTurn) return;
    const plays = playables.filter((p) => p.card === i);
    if (plays.length === 0) return;
    const withColor = plays.filter((p) => p.color !== undefined);
    if (withColor.length > 0) {
      setColorPick(i);
      return;
    }
    onAction({ type: 'play', card: i });
  };

  const pickColor = (c: UnoColor) => {
    if (colorPick === null) return;
    onAction({ type: 'play', card: colorPick, color: c });
    setColorPick(null);
  };

  const top = state.discard[state.discard.length - 1];
  const wildPending = colorPick !== null;

  return (
    <div className="board-wrap">
      <div className="row-between">
        <div>
          <h3>7G Uno</h3>
          <span className="dim" style={{ fontSize: 13 }}>
            {state.status === 'finished'
              ? state.result
                ? `${state.result.winner} gagne !`
                : 'Terminé'
              : myTurn
                ? wildPending
                  ? 'Choisissez la couleur'
                  : 'Jouez une carte'
                : `${players[state.turn]} joue…`}
          </span>
        </div>
        <span className="pill">→ {state.direction > 0 ? '↻' : '↺'} · {players[state.turn]}</span>
      </div>

      <div className="row" style={{ justifyContent: 'space-around', padding: '10px 0' }}>
        <div className="col" style={{ alignItems: 'center', gap: 4 }}>
          <button className="btn btn-ghost" disabled={!canDraw || !canAct || !myTurn} onClick={() => onAction({ type: 'draw' })} style={{ background: '#454a80' }}>
            <CardFace card={{ color: null, value: 'wild' }} small />
          </button>
          <span className="dim" style={{ fontSize: 11 }}>Pioche ({state.drawPile.length})</span>
        </div>
        <div className="col" style={{ alignItems: 'center', gap: 4 }}>
          {top && <CardFace card={top} />}
          <span className="dim" style={{ fontSize: 11 }}>
            Défausse {state.currentColor ? `· ${COLOR_LABEL[state.currentColor]}` : ''}
          </span>
        </div>
        <div className="col" style={{ alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 22 }}>➕</span>
          <span className="dim" style={{ fontSize: 11 }}>Pioche forcée : {state.pendingDraw}</span>
        </div>
      </div>

      {wildPending && (
        <div className="card center">
          <h3>Choisir la couleur</h3>
          <div className="row" style={{ justifyContent: 'center' }}>
            {(Object.keys(COLOR_HEX) as UnoColor[]).map((c) => (
              <button
                key={c}
                onClick={() => pickColor(c)}
                style={{ width: 48, height: 48, borderRadius: 12, border: '2px solid #fff', background: COLOR_HEX[c], cursor: 'pointer' }}
                aria-label={COLOR_LABEL[c]}
              />
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 8 }}>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 6, minHeight: 60 }}>
          {myHand.map((card, i) => {
            const isNull = card === null;
            const playable = playables.some((p) => p.card === i) || playables.some((p) => p.card === i && p.color !== undefined);
            const cardObj = (isNull ? { color: null as UnoColor | null, value: 'wild' } : card) as {
              color: UnoColor | null;
              value: number | string;
            };
            return (
              <button
                key={i}
                onClick={() => tapCard(i)}
                disabled={!playable || !canAct || !myTurn}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  transform: playable && canAct && myTurn ? 'translateY(-4px)' : undefined,
                  opacity: playable ? 1 : 0.85,
                  flex: '0 0 auto',
                }}
              >
                {isNull ? <CardFace card={cardObj} small /> : <CardFace card={cardObj} />}
              </button>
            );
          })}
          {myHand.length === 0 && state.status !== 'finished' && <span className="dim">Aucune carte</span>}
        </div>
      </div>

      {state.result && (
        <div className="card">
          <h3>Classement final</h3>
          {Object.entries(state.result.scores)
            .sort((a, b) => b[1] - a[1])
            .map(([pid, sc]) => (
              <div key={pid} className="row-between">
                <span>{players.includes(pid) ? players[players.indexOf(pid)] : pid}</span>
                <b>{sc} pts</b>
              </div>
            ))}
        </div>
      )}

      <div className="player-strip">
        {players.map((p, i) => (
          <span key={p} className={`pchip${state.turn === i && state.status !== 'finished' ? ' turn' : ''}`}>
            {p} · {i === me ? myHand.length : (state.hands[i] ?? []).filter((c) => c !== null).length} cartes
          </span>
        ))}
      </div>
    </div>
  );
}
