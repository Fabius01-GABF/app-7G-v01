import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';

type Role = 'player' | 'moderator' | 'editor' | 'admin' | 'super_admin';

const ADMIN_ROLES: Role[] = ['moderator', 'editor', 'admin', 'super_admin'];
const ALL_ROLES: Role[] = ['player', 'moderator', 'editor', 'admin', 'super_admin'];

interface Dashboard {
  users: number;
  matches: number;
  online: number;
  avg_xp: number;
  open_reports: number;
}

interface UserRow {
  id: number;
  username: string;
  email: string;
  role: string;
  active: number;
  last_seen_at: string | null;
}

interface Cat {
  id: number;
  name: string;
  enabled: number | boolean;
}

interface QuestionRow {
  id: number;
  category_id: number;
  category_name: string;
  text: string;
  difficulty: string;
  correct_index?: number;
  answers: string[];
  enabled: boolean;
}

export function AdminScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'dash' | 'users' | 'quiz'>('dash');
  const isEditor = user && (user.role === 'editor' || user.role === 'admin' || user.role === 'super_admin');
  const isMod = user && (ADMIN_ROLES as string[]).includes(user.role);

  if (!user || !isMod) {
    return (
      <div className="screen">
        <div className="card center">
          <h3>⛔ Accès réservé</h3>
          <p className="dim">Vous n’avez pas les droits de modération.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen fade-in">
      <h2>🛠 Administration</h2>
      <div className="segment">
        <button className={tab === 'dash' ? 'on' : ''} onClick={() => setTab('dash')}>Tableau de bord</button>
        <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>Utilisateurs</button>
        {isEditor && <button className={tab === 'quiz' ? 'on' : ''} onClick={() => setTab('quiz')}>Quiz</button>}
      </div>
      {tab === 'dash' && <Dash />}
      {tab === 'users' && <Users />}
      {tab === 'quiz' && <QuizAdmin />}
    </div>
  );
}

function Dash() {
  const [d, setD] = useState<Dashboard | null>(null);
  useEffect(() => {
    api<Dashboard>('/admin/dashboard').then(setD).catch(() => {});
  }, []);
  if (!d) return <div className="spinner" />;
  return (
    <div className="card">
      <div className="stats-grid">
        <div className="stat"><b>{d.users}</b><span>Utilisateurs</span></div>
        <div className="stat"><b>{d.matches}</b><span>Parties</span></div>
        <div className="stat"><b>{d.online}</b><span>En ligne</span></div>
        <div className="stat"><b>{d.avg_xp}</b><span>XP moyen</span></div>
        <div className="stat"><b>{d.open_reports}</b><span>Signalements ouverts</span></div>
      </div>
    </div>
  );
}

function Users() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');

  const load = (query = q) => {
    api<{ rows: UserRow[] }>(`/users?q=${encodeURIComponent(query)}&pageSize=50`)
      .then((r) => setRows(r.rows))
      .catch(() => {});
  };
  useEffect(() => load(''), []);

  const toggleActive = async (u: UserRow) => {
    await api(`/users/${u.id}/active`, { method: 'PATCH', body: JSON.stringify({ active: u.active === 1 ? false : true }) });
    setMsg('Utilisateur mis à jour.');
    load(q);
  };
  const setRole = async (u: UserRow, role: string) => {
    await api(`/users/${u.id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
    setMsg('Rôle mis à jour.');
    load(q);
  };

  return (
    <div className="card col">
      <input placeholder="Rechercher…" value={q} onChange={(e) => { setQ(e.target.value); load(e.target.value); }} />
      {msg && <p className="dim" style={{ fontSize: 13 }}>{msg}</p>}
      {rows.map((u) => (
        <div key={u.id} className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <b>{u.username}</b> <span className="pill">{u.role}</span>
            <p className="dim" style={{ margin: 0, fontSize: 12 }}>{u.email}</p>
          </div>
          <div className="row">
            <select value={u.role} onChange={(e) => setRole(u, e.target.value)}>
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(u)}>
              {u.active === 1 ? 'Désactiver' : 'Activer'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function QuizAdmin() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [qs, setQs] = useState<QuestionRow[]>([]);
  const [newCat, setNewCat] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ text: '', category_id: '', difficulty: 'medium', correct_index: 0, answers: ['', '', '', ''] });

  const load = async () => {
    const c = await api<Cat[]>('/quiz/categories');
    setCats(c);
    const qres = await api<{ rows: QuestionRow[] }>('/quiz/questions?include_all=true&pageSize=100');
    setQs(qres.rows);
  };
  useEffect(() => { load().catch(() => {}); }, []);

  const createCat = async () => {
    await api('/quiz/categories', { method: 'POST', body: JSON.stringify({ name: newCat }) });
    setNewCat('');
    setMsg('Catégorie créée.');
    load();
  };

  const toggleCat = async (c: Cat) => {
    await api(`/quiz/categories/${c.id}/enabled`, { method: 'PATCH', body: JSON.stringify({ enabled: Number(c.enabled) === 1 ? false : true }) });
    load();
  };

  const createQ = async () => {
    const answers = form.answers.map((a) => a.trim()).filter(Boolean);
    await api('/quiz/questions', {
      method: 'POST',
      body: JSON.stringify({ text: form.text, category_id: Number(form.category_id), difficulty: form.difficulty, correct_index: form.correct_index, answers }),
    });
    setMsg('Question créée.');
    load();
  };

  return (
    <div className="col">
      <div className="card col">
        <h4>Nouvelle catégorie</h4>
        <div className="row">
          <input placeholder="Nom (ex : Animaux)" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <button className="btn" onClick={createCat}>Ajouter</button>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {cats.map((c) => (
            <span key={c.id} className="pill" onClick={() => toggleCat(c)}>
              {c.name} {Number(c.enabled) === 1 ? '✓' : '✗'}
            </span>
          ))}
        </div>
      </div>

      <div className="card col">
        <h4>Nouvelle question</h4>
        <input placeholder="Question…" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
        <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
          <option value="">Catégorie…</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="segment">
          {(['easy', 'medium', 'hard'] as const).map((d) => (
            <button key={d} className={form.difficulty === d ? 'on' : ''} onClick={() => setForm({ ...form, difficulty: d })}>
              {d}
            </button>
          ))}
        </div>
        {form.answers.map((a, i) => (
          <input
            key={i}
            placeholder={`Réponse ${i + 1}`}
            value={a}
            onChange={(e) => setForm({ ...form, answers: form.answers.map((x, j) => (j === i ? e.target.value : x)) })}
          />
        ))}
        <div className="row">
          <label>Bonne réponse</label>
          <select value={form.correct_index} onChange={(e) => setForm({ ...form, correct_index: Number(e.target.value) })}>
            {form.answers.map((_, i) => (
              <option key={i} value={i}>{i + 1}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary btn-block" onClick={createQ}>Créer la question</button>
      </div>

      {msg && <p className="dim" style={{ fontSize: 13 }}>{msg}</p>}
      <div className="card col">
        <h4>Questions ({qs.length})</h4>
        {qs.map((qq) => (
          <div key={qq.id} className="row-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13 }}>{qq.text} <span className="dim">({qq.category_name})</span></span>
            <span className="pill">{qq.enabled ? '✓' : '✗'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
