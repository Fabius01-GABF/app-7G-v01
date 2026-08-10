import { useMemo, useState } from 'react';
import type { ChessState, ChessMove } from '@shared/index';

interface Props {
  state: ChessState;
  canAct: boolean;
  actions: ChessMove[];
  meId: string;
  onAction: (a: ChessMove) => void;
  players: string[];
  online?: boolean;
}

const GLYPH: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

const FILES = 'abcdefgh';

export function ChessBoard({ state, canAct, actions, meId, onAction, players }: Props) {
  const [sel, setSel] = useState<number | null>(null);

  const movesFor = useMemo(() => {
    const map = new Map<number, ChessMove[]>();
    for (const m of actions) {
      const list = map.get(m.from) ?? [];
      list.push(m);
      map.set(m.from, list);
    }
    return map;
  }, [actions]);

  const fromSel = sel !== null ? (movesFor.get(sel) ?? []) : [];
  const toSet = useMemo(() => new Set(fromSel.map((m) => m.to)), [fromSel]);
  const promotions = useMemo(
    () => fromSel.filter((m) => m.promotion),
    [fromSel],
  );

  const myColor = players.indexOf(meId) === 0 ? 'w' : 'b';
  const orientation = myColor === 'b' ? 1 : 0;
  const turnName = players[state.turn === 'w' ? 0 : 1];
  const isMyTurn = state.turn === myColor;

  if (promotions.length > 0) {
    return (
      <div className="card center">
        <h3>Promotion du pion</h3>
        <p className="dim">Choisissez une pièce</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          {(['Q', 'R', 'N', 'B'] as const).map((p) => {
            const m = promotions.find((x) => x.promotion === p);
            if (!m) return null;
            return (
              <button
                key={p}
                className="btn btn-ghost"
                style={{ fontSize: 26, width: 56, height: 56 }}
                onClick={() => {
                  onAction(m);
                  setSel(null);
                }}
              >
                {GLYPH[p]}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const rows = [];
  for (let i = 0; i < 8; i++) {
    const cells = [];
    for (let j = 0; j < 8; j++) {
      const visualRow = orientation === 1 ? i : 7 - i;
      const visualCol = orientation === 1 ? 7 - j : j;
      const idx = visualRow * 8 + visualCol;
      const piece = state.board[idx];
      const dark = (visualRow + visualCol) % 2 === 1;
      const isSel = sel === idx;
      const isTarget = toSet.has(idx);
      const isCapture = isTarget && piece !== '';
      cells.push(
        <button
          key={idx}
          className="sq"
          data-dark={dark ? '1' : '0'}
          data-sel={isSel ? '1' : '0'}
          data-target={isTarget ? '1' : '0'}
          onClick={() => {
            if (!canAct || !isMyTurn) return;
            if (isSel) {
              setSel(null);
              return;
            }
            if (isTarget) {
              onAction({ from: sel!, to: idx });
              setSel(null);
              return;
            }
            const m = movesFor.get(idx);
            if (m && m.length > 0) {
              if (m.some((x) => x.promotion)) {
                setSel(idx);
              } else if (m.length === 1) {
                onAction(m[0]);
              } else {
                setSel(idx);
              }
            } else {
              setSel(null);
            }
          }}
          aria-label={FILES[visualCol] + (8 - visualRow)}
          style={{
            position: 'relative',
            display: 'grid',
            placeItems: 'center',
            aspectRatio: '1',
            border: 'none',
            padding: 0,
            fontSize: 'clamp(18px, 8vw, 34px)',
            background: dark ? '#5a5f9e' : '#eceefb',
            color: dark ? '#f4f4ff' : '#20223c',
            borderRadius: 0,
          }}
        >
          {piece !== '' && <span style={{ filter: piece === piece.toUpperCase() ? 'none' : 'drop-shadow(0 1px 1px rgba(0,0,0,.4))' }}>{GLYPH[piece]}</span>}
          {isCapture && <span style={{ position: 'absolute', inset: 0, borderRadius: 0, boxShadow: 'inset 0 0 0 3px #e74c3c' }} />}
          {!piece && isTarget && <span style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: 'rgba(46,204,113,.7)' }} />}
        </button>,
      );
    }
    rows.push(
      <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0 }}>
        {cells}
      </div>,
    );
  }

  return (
    <div className="board-wrap">
      <div className="row-between">
        <div>
          <h3>{players[0]} <span className="dim">(blanc)</span> vs <span className="dim">{players[1]}</span></h3>
          <span className="dim" style={{ fontSize: 13 }}>
            {state.result ? 'Partie terminée' : isMyTurn ? 'À vous de jouer' : `${turnName} réfléchit…`}
            {state.status !== 'finished' && isMyTurn && !canAct ? ' (IA)' : ''}
          </span>
        </div>
        <span className={`pill${state.status !== 'finished' && isMyTurn ? '' : ''}`} style={{ fontSize: 13 }}>
          {state.status === 'finished' ? (state.result?.winner ? `${players[state.result.winner === players[0] ? 0 : 1]} gagne` : 'Nulle') : 'Trait aux ' + (state.turn === 'w' ? 'blancs' : 'noirs')}
        </span>
      </div>
      <div style={{ border: '2px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>{rows}</div>
      {state.history.length > 0 && (
        <div className="card" style={{ padding: 10 }}>
          <span className="dim" style={{ fontSize: 12 }}>Coups : </span>
          <span style={{ fontSize: 13, wordBreak: 'break-word' }}>
            {state.history.slice(-12).map((h, i) => (
              <span key={i}>{h.move.from}-{h.move.to} </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
