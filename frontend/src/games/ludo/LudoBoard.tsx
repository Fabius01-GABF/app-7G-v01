import type { LudoState, LudoAction } from '@shared/index';

interface Props {
  state: LudoState;
  canAct: boolean;
  actions: LudoAction[];
  meId: string;
  onAction: (a: LudoAction) => void;
  players: string[];
  online?: boolean;
}

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f'];
const PLAYER_DARK = ['#a93226', '#1f618d', '#1e8449', '#b7950b'];

const RING: [number, number][] = [];
for (let c = 0; c <= 14; c++) RING.push([8, c]);
for (let r = 13; r >= 9; r--) RING.push([r, 8]);
RING.push([7, 14]);
for (let r = 1; r <= 5; r++) RING.push([r, 8]);
for (let c = 14; c >= 0; c--) RING.push([6, c]);
RING.push([7, 0]);
for (let r = 1; r <= 5; r++) RING.push([r, 6]);
for (let r = 9; r <= 13; r++) RING.push([r, 6]);

const RAMPS: [number, number][][] = [
  [[9, 7], [10, 7], [11, 7], [12, 7], [13, 7]],
  [[7, 9], [7, 10], [7, 11], [7, 12], [7, 13]],
  [[5, 7], [4, 7], [3, 7], [2, 7], [1, 7]],
  [[7, 5], [7, 4], [7, 3], [7, 2], [7, 1]],
];
const HOME: [number, number] = [7, 7];

const BASE_ORIGIN: [number, number][] = [
  [9, 0],
  [9, 9],
  [0, 9],
  [0, 0],
];
const BASE_PAWN_OFFSETS: [number, number][] = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
];

export function LudoBoard({ state, canAct, actions, meId, onAction, players }: Props) {
  const me = players.indexOf(meId);
  const myTurn = state.turn === me;
  const moveable = new Set<number>(actions.filter((a) => a.type === 'move').map((a) => (a as { pawn: number }).pawn));
  const canPass = actions.some((a) => a.type === 'pass');
  const canRoll = actions.some((a) => a.type === 'roll');

  const cells: { key: string; content: React.ReactNode; clickable: boolean; onClick?: () => void }[][] = [];
  for (let r = 0; r < 15; r++) {
    const row: { key: string; content: React.ReactNode; clickable: boolean; onClick?: () => void }[] = [];
    for (let c = 0; c < 15; c++) {
      let content: React.ReactNode = null;
      let clickable = false;
      let onClick: (() => void) | undefined;

      const pawnsHere: number[] = [];
      state.pawns.forEach((journey, pi) => {
        if (journey === -1) return;
        const p = Math.floor(pi / 4);
        let coord: [number, number] | null = null;
        if (journey <= 50) coord = RING[(p * 13 + journey) % 52];
        else if (journey <= 55) coord = RAMPS[p][journey - 51];
        else coord = HOME;
        if (coord[0] === r && coord[1] === c) pawnsHere.push(pi);
      });

      if (pawnsHere.length > 0) {
        content = (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', gap: 1 }}>
            {pawnsHere.map((pi, i) => {
              const p = Math.floor(pi / 4);
              const isMine = me >= 0 && p === me;
              const canMove = moveable.has(pi);
              return (
                <span
                  key={pi}
                  style={{
                    width: '40%',
                    aspectRatio: '1',
                    borderRadius: '50%',
                    background: PLAYER_COLORS[p],
                    border: `2px solid ${canMove ? '#fff' : PLAYER_DARK[p]}`,
                    boxShadow: canMove ? '0 0 0 2px #f7b731' : '0 1px 2px rgba(0,0,0,.4)',
                    transform: i > 0 ? 'translate(-1px,-1px)' : undefined,
                  }}
                />
              );
            })}
          </div>
        );
        if (canAct && myTurn) {
          const moving = pawnsHere.find((pi) => moveable.has(pi));
          if (moving !== undefined) {
            clickable = true;
            onClick = () => onAction({ type: 'move', pawn: moving });
          }
        }
      }

      row.push({
        key: `${r}-${c}`,
        content,
        clickable,
        onClick,
      });
    }
    cells.push(row);
  }

  const grid = cells.map((row, r) => (
    <div key={r} style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)' }}>
      {row.map((cell, c) => {
        const onRing = RING.some(([rr, cc]) => rr === r && cc === c);
        const rampOf = RAMPS.findIndex((ramp) => ramp.some(([rr, cc]) => rr === r && cc === c));
        const isHome = r === 7 && c === 7;
        const inBase = BASE_ORIGIN.some(([br, bc], i) => {
          const [dr, dc] = BASE_PAWN_OFFSETS[i];
          return r >= br && r < br + 2 && c >= bc && c < bc + 2;
        });
        return (
          <button
            key={cell.key}
            onClick={cell.onClick}
            disabled={!cell.onClick}
            style={{
              aspectRatio: '1',
              border: 'none',
              padding: 0,
              background: isHome
                ? '#3b3f6e'
                : rampOf >= 0
                  ? PLAYER_COLORS[rampOf]
                  : onRing
                    ? '#f2f3ff'
                    : inBase
                      ? 'transparent'
                      : 'transparent',
              borderRadius: 2,
              cursor: cell.onClick ? 'pointer' : 'default',
              position: 'relative',
            }}
          >
            {isHome && <span style={{ fontSize: 9 }}>⭐</span>}
            {cell.content}
          </button>
        );
      })}
    </div>
  ));

  // base pawns (journey -1)
  const baseRender = BASE_ORIGIN.map((origin, p) => {
    const pawnsInBase = [0, 1, 2, 3].map((k) => p * 4 + k).filter((pi) => state.pawns[pi] === -1);
    return (
      <div
        key={p}
        style={{
          position: 'absolute',
          top: origin[0] * (100 / 15) + '%',
          left: origin[1] * (100 / 15) + '%',
          width: (2 * 100) / 15 + '%',
          height: (2 * 100) / 15 + '%',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
          gap: 2,
          padding: 3,
          placeItems: 'center',
        }}
      >
        {pawnsInBase.map((pi) => {
          const k = pi - p * 4;
          const [dr, dc] = BASE_PAWN_OFFSETS[k];
          const isMine = me >= 0 && p === me;
          const canMove = moveable.has(pi);
          return (
            <button
              key={pi}
              onClick={canAct && myTurn && canMove ? () => onAction({ type: 'move', pawn: pi }) : undefined}
              disabled={!canAct || !myTurn || !canMove}
              style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: '50%',
                border: `2px solid ${canMove ? '#f7b731' : PLAYER_DARK[p]}`,
                background: PLAYER_COLORS[p],
                gridColumn: dc + 1,
                gridRow: dr + 1,
                cursor: canMove ? 'pointer' : 'default',
              }}
            />
          );
        })}
      </div>
    );
  });

  const winnerName = state.result ? players[state.playerIds.indexOf(state.result.winner)] : null;

  return (
    <div className="board-wrap">
      <div className="row-between">
        <div>
          <h3>7G Ludo</h3>
          <span className="dim" style={{ fontSize: 13 }}>
            {state.status === 'finished'
              ? winnerName
                ? `${winnerName} gagne !`
                : 'Partie terminée'
              : myTurn
                ? state.phase === 'roll'
                  ? 'Lancez le dé'
                  : 'Choisissez un pion'
                : `${players[state.turn]} joue…`}
          </span>
        </div>
        <span className="pill" style={{ fontSize: 16 }}>🎲 {state.dice ?? '—'}</span>
      </div>

      <div className="card" style={{ position: 'relative', padding: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)' }}>{grid}</div>
        {baseRender}
      </div>

      {canAct && myTurn && state.phase === 'roll' && (
        <button className="btn btn-block" onClick={() => onAction({ type: 'roll' })} disabled={!canRoll}>
          Lancer le dé
        </button>
      )}
      {canAct && myTurn && canPass && (
        <button className="btn btn-block btn-ghost" onClick={() => onAction({ type: 'pass' })}>
          Passer (aucun pion jouable)
        </button>
      )}

      <div className="player-strip">
        {players.map((p, i) => (
          <span key={p} className={`pchip${state.turn === i && state.status !== 'finished' ? ' turn' : ''}`}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: PLAYER_COLORS[i], display: 'inline-block' }} />
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}
