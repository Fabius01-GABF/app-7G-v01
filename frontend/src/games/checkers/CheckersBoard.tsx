import { useMemo, useState } from 'react';
import type { CheckersState, CheckersMove } from '@shared/index';

interface Props {
  state: CheckersState;
  canAct: boolean;
  actions: CheckersMove[];
  meId: string;
  onAction: (a: CheckersMove) => void;
  players: string[];
  online?: boolean;
}

export function CheckersBoard({ state, canAct, actions, meId, onAction, players }: Props) {
  const [sel, setSel] = useState<number | null>(null);

  const movesFrom = useMemo(() => {
    const map = new Map<number, CheckersMove[]>();
    for (const m of actions) {
      const l = map.get(m.from) ?? [];
      l.push(m);
      map.set(m.from, l);
    }
    return map;
  }, [actions]);

  const toSet = useMemo(() => {
    const s = new Set<number>();
    if (sel !== null) for (const m of movesFrom.get(sel) ?? []) s.add(m.to);
    return s;
  }, [sel, movesFrom]);

  const myTurn = state.turn === players.indexOf(meId);
  const isForced = state.mustCapture !== null;

  const cells = [];
  for (let r = 0; r < 8; r++) {
    const row = [];
    for (let c = 0; c < 8; c++) {
      const idx = r * 8 + c;
      const piece = state.board[idx];
      const dark = (r + c) % 2 === 1;
      const isSel = sel === idx;
      const isTarget = toSet.has(idx);
      const isCaptureTarget = isTarget && piece !== '';
      const movable = dark && canAct && myTurn && movesFrom.has(idx) && (sel === null || !isTarget);

      row.push(
        <button
          key={idx}
          className="sq"
          onClick={() => {
            if (!dark || !canAct || !myTurn) return;
            if (isSel) {
              setSel(null);
              return;
            }
            if (isTarget) {
              onAction({ from: sel!, to: idx });
              setSel(null);
              return;
            }
            if (movesFrom.has(idx)) {
              const ms = movesFrom.get(idx)!;
              if (ms.length === 1 && !isForced) {
                onAction(ms[0]);
                setSel(null);
              } else {
                setSel(idx);
              }
            }
          }}
          aria-label={`cellule ${idx}`}
          style={{
            position: 'relative',
            display: 'grid',
            placeItems: 'center',
            aspectRatio: '1',
            border: 'none',
            padding: 0,
            background: dark ? (isSel ? '#7d6cf0' : '#4b4f8a') : '#eceefb',
            borderRadius: 0,
          }}
        >
          {piece !== '' && (
            <span
              style={{
                width: '72%',
                height: '72%',
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background:
                  piece === 'b' || piece === 'B'
                    ? 'radial-gradient(circle at 35% 30%, #555, #111)'
                    : 'radial-gradient(circle at 35% 30%, #fff, #b0b0c0)',
                boxShadow: '0 2px 4px rgba(0,0,0,.4)',
                fontSize: 'clamp(10px, 3vw, 14px)',
                color: piece === 'b' || piece === 'B' ? '#ddd' : '#222',
                fontWeight: 800,
              }}
            >
              {piece === 'B' || piece === 'W' ? '♛' : ''}
            </span>
          )}
          {isCaptureTarget && <span style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 3px #e74c3c', borderRadius: 0 }} />}
          {isTarget && piece === '' && <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(46,204,113,.8)' }} />}
        </button>,
      );
    }
    cells.push(
      <div key={r} style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0 }}>
        {row}
      </div>,
    );
  }

  const winnerName = state.result?.winner ? players[state.playerIds.indexOf(state.result.winner) === 0 ? 0 : 1] : null;

  return (
    <div className="board-wrap">
      <div className="row-between">
        <div>
          <h3>{players[0]} vs {players[1]}</h3>
          <span className="dim" style={{ fontSize: 13 }}>
            {state.status === 'finished'
              ? winnerName
                ? `${winnerName} gagne`
                : 'Partie nulle'
              : myTurn
                ? isForced
                  ? 'Capture obligatoire !'
                  : 'À vous de jouer'
                : `${players[state.turn]} joue…`}
          </span>
        </div>
        <span className="pill">Trait : {players[state.turn]}</span>
      </div>
      <div style={{ border: '2px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>{cells}</div>
    </div>
  );
}
