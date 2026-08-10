import { useEffect, useRef, useState } from 'react';
import type { CityState, CityAction } from '@shared/index';
import { CITY_BOARD } from '@shared/index';

type CitySquare = (typeof CITY_BOARD)[number];

interface Props {
  state: CityState;
  canAct: boolean;
  actions: unknown[];
  meId: string;
  onAction: (a: CityAction) => void;
  players: string[];
  online?: boolean;
}

const OP_LABEL: Record<string, string> = {
  buyHouse: '🏠 Construire',
  sellHouse: 'Vendre maison',
  mortgage: 'Hypothéquer',
  unmortgage: 'Racheter',
};

export function CityBoard({ state, canAct, actions, meId, onAction, players }: Props) {
  const [selected, setSelected] = useState<CitySquare | null>(null);
  const me = players.indexOf(meId);
  const cur = state.turn;

  useEffect(() => {
    setSelected(null);
  }, [state.turn, state.phase, state.round]);

  const validActions = (actions as CityAction[]) ?? [];
  const squareOf = (i: number) => CITY_BOARD[i];

  if (state.status === 'finished') {
    return (
      <div className="board-wrap">
        <div className="card center">
          <h3>Partie terminée !</h3>
          {state.result && (
            <div className="col mt">
              {(state.result.rank ?? []).map((pid, i) => (
                <div key={pid} className="row-between">
                  <span>
                    {i + 1}. {players.includes(pid) ? players[players.indexOf(pid)] : pid}
                    {pid === state.result?.winner ? ' 🏆' : ''}
                  </span>
                  <b>{state.money[players.indexOf(pid)] ?? 0} €</b>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="board-wrap">
      <div className="row-between">
        <h3>7G City</h3>
        <span className="dim" style={{ fontSize: 13 }}>
          Tour {state.round + 1}
        </span>
      </div>

      <div className="row gap-sm" style={{ overflowX: 'auto', paddingBottom: 4 }}>
        {players.map((p, i) => (
          <div key={p} className={`pchip${i === cur ? ' turn' : ''}`} style={{ flex: '0 0 auto' }}>
            {p} · {state.money[i] ?? 0}€
          </div>
        ))}
      </div>

      <div className="city-grid">
        {CITY_BOARD.map((sq, i) => {
          const prop = state.properties[i];
          const owner = prop.owner;
          const isMe = i === state.positions[cur];
          const sel = selected?.index === i;
          return (
            <button
              key={i}
              className={`city-cell${sel ? ' sel' : ''}${owner >= 0 ? ' owned' : ''}`}
              style={{
                background: owner >= 0 && sq.type === 'property' ? `color-mix(in srgb, ${sq.color ?? '#999'} 30%, transparent)` : undefined,
                borderColor: sel ? 'var(--accent)' : 'var(--border)',
              }}
              onClick={() => setSelected(sel ? null : sq)}
            >
              <span className="city-idx">{i}</span>
              {isMe && <span className="city-you">●</span>}
              <span className="city-name">{sq.name}</span>
              {sq.type === 'property' && (
                <span className="city-meta">
                  {sq.price}€{prop.houses > 0 ? ` ${'🏠'.repeat(prop.houses)}` : ''}
                  {prop.mortgaged ? ' 🕳' : ''}
                  {owner >= 0 && !prop.mortgaged ? ` · ${players[owner] ?? ''}` : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="card">
          <div className="row-between">
            <h4>{selected.name}</h4>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
          </div>
          {selected.type === 'property' ? (
            <>
              <p className="dim" style={{ fontSize: 13 }}>
                Prix {selected.price}€ · Loyer {state.properties[selected.index].mortgaged ? 0 : Math.max(4, Math.floor((selected.price ?? 0) * 0.08))}€
                {state.properties[selected.index].houses > 0 ? ` (x${[1, 3, 6, 10, 15, 24][state.properties[selected.index].houses]})` : ''}
              </p>
              {canAct &&
                validActions
                  .filter((a): a is Extract<CityAction, { type: 'build' }> => a.type === 'build' && a.prop === selected.index)
                  .map((a, i) => (
                    <button key={i} className="btn btn-ghost btn-block mt" onClick={() => onAction(a)}>
                      {OP_LABEL[a.op]}
                    </button>
                  ))}
            </>
          ) : (
            <p className="dim" style={{ fontSize: 13 }}>
              {selected.type === 'go' ? 'Encaissez 200€ en passant le départ.' : selected.type === 'jail' ? 'Simple visite.' : selected.type === 'tax' ? `Payez ${selected.tax}€.` : 'Piochez une carte Chance.'}
            </p>
          )}
        </div>
      )}

      {canAct && (
        <div className="col mt">
          {state.phase === 'roll' && (
            <button className="btn btn-primary btn-block" onClick={() => onAction({ type: 'roll' })}>
              🎲 Lancer les dés
            </button>
          )}
          {state.phase === 'buy' && (
            <>
              <button className="btn btn-primary btn-block" onClick={() => onAction({ type: 'buy' })}>
                Acheter ({CITY_BOARD[state.positions[cur]].price}€)
              </button>
              <button className="btn btn-ghost btn-block" onClick={() => onAction({ type: 'pass' })}>
                Passer
              </button>
            </>
          )}
          {state.phase === 'build' && (
            <button className="btn btn-primary btn-block" onClick={() => onAction({ type: 'endTurn' })}>
              Terminer le tour
            </button>
          )}
        </div>
      )}

      {!canAct && state.status === 'playing' && (
        <p className="dim center mt" style={{ fontSize: 13 }}>
          {state.playerIds[cur]} est en train de jouer…
        </p>
      )}
    </div>
  );
}
