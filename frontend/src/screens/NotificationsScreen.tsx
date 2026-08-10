import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Notif {
  id: number;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export function NotificationsScreen() {
  const [rows, setRows] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api<{ rows: Notif[]; unread: number }>('/notifications?pageSize=50')
      .then((r) => {
        setRows(r.rows);
        setUnread(r.unread);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const markAll = async () => {
    await api('/notifications/read-all', { method: 'POST' });
    load();
  };

  const markOne = async (id: number) => {
    await api(`/notifications/${id}/read`, { method: 'POST' });
    load();
  };

  return (
    <div className="screen fade-in">
      <div className="row-between">
        <h2>🔔 Alertes</h2>
        {unread > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={markAll}>
            Tout marquer lu
          </button>
        )}
      </div>
      {error && <p className="dim">{error}</p>}
      {rows.length === 0 && !error && <p className="dim">Aucune notification.</p>}
      <div className="card col">
        {rows.map((n) => (
          <div
            key={n.id}
            className="row-between"
            style={{
              padding: '10px 0',
              borderBottom: '1px solid var(--border)',
              opacity: n.read ? 0.6 : 1,
            }}
            onClick={() => !n.read && markOne(n.id)}
          >
            <div>
              <b>{n.title}</b>
              <p className="dim" style={{ margin: 0, fontSize: 13 }}>{n.body}</p>
            </div>
            {!n.read && <span className="badge-dot">!</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
