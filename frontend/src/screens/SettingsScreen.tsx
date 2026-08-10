import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';

const EMOJIS = ['😀', '😎', '🤓', '🦊', '🐼', '🐸', '🐙', '👾', '🤖', '🦄', '🐯', '🐺'];
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

export function SettingsScreen() {
  const { user, setUser, refresh } = useAuth();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!user) return null;

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await api<{ user: typeof user }>('/profiles/me', { method: 'PATCH', body: JSON.stringify(body) });
      setUser(res.user);
      setMsg('Enregistré.');
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen fade-in">
      <h2>⚙️ Réglages</h2>

      <div className="card col">
        <label>Thème</label>
        <div className="segment">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button key={t} className={user.theme === t ? 'on' : ''} onClick={() => patch({ theme: t })}>
              {t === 'light' ? '☀️ Clair' : t === 'dark' ? '🌙 Sombre' : '🖥 Système'}
            </button>
          ))}
        </div>
      </div>

      <div className="card col">
        <label>Avatar</label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {EMOJIS.map((e) => (
            <button key={e} className="avatar" style={{ background: user.avatar_color, filter: user.avatar_emoji === e ? 'none' : 'grayscale(.5)', outline: user.avatar_emoji === e ? '2px solid var(--accent)' : 'none' }} onClick={() => patch({ avatar_emoji: e })}>
              {e}
            </button>
          ))}
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {COLORS.map((c) => (
            <button
              key={c}
              className="color-swatch"
              style={{ background: c, outline: user.avatar_color === c ? '2px solid var(--accent)' : 'none' }}
              onClick={() => patch({ avatar_color: c })}
            />
          ))}
        </div>
      </div>

      <div className="card col">
        <label>Bio</label>
        <textarea
          value={user.bio}
          maxLength={160}
          onChange={(e) => setUser({ ...user, bio: e.target.value })}
          placeholder="Parlez de vous…"
        />
        <button className="btn btn-block" disabled={saving} onClick={() => patch({ bio: user.bio })}>
          Enregistrer la bio
        </button>
      </div>

      <div className="card col">
        <label>Notifications</label>
        <button
          className="btn btn-block"
          disabled={saving}
          onClick={() => patch({ notifications_enabled: !user.notifications_enabled })}
        >
          {user.notifications_enabled ? 'Activées ✓' : 'Désactivées'}
        </button>
      </div>

      {msg && <p className="center" style={{ color: 'var(--green)', fontSize: 13 }}>{msg}</p>}
      {err && <p className="center dim" style={{ fontSize: 13 }}>{err}</p>}
    </div>
  );
}
