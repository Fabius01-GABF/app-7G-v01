import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';

type Tab = 'login' | 'register';

export function AuthScreen() {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<Tab>('login');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [loginName, setLoginName] = useState('');
  const [newName, setNewName] = useState('');

  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur.');
    } finally {
      setBusy(false);
    }
  };

  const onLogin = (e: FormEvent) => {
    e.preventDefault();
    void run(() => login(loginName.trim()));
  };

  const onRegister = (e: FormEvent) => {
    e.preventDefault();
    void run(() => register(newName.trim()));
  };

  const tabBtn = (t: Tab, label: string) => (
    <button type="button" className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
      {label}
    </button>
  );

  return (
    <div className="container center" style={{ maxWidth: 420, paddingTop: 48 }}>
      <h1>
        7G<b>Zone</b>
      </h1>
      <p className="dim">7 jeux classiques, classements et défis en ligne</p>

      <div className="segment mt" style={{ marginBottom: 16 }}>
        {tabBtn('login', 'Connexion')}
        {tabBtn('register', 'Inscription')}
      </div>

      {err && <div className="error-box">{err}</div>}

      {tab === 'login' && (
        <form className="card col" onSubmit={onLogin}>
          <p className="dim" style={{ fontSize: 13, marginTop: 0 }}>
            Entrez votre pseudo pour vous connecter.
          </p>
          <div>
            <label>Pseudo</label>
            <input value={loginName} onChange={(e) => setLoginName(e.target.value)} autoComplete="username" required />
          </div>
          <button className="btn btn-block" disabled={busy}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      )}

      {tab === 'register' && (
        <form className="card col" onSubmit={onRegister}>
          <p className="dim" style={{ fontSize: 13, marginTop: 0 }}>
            Choisissez un pseudo — pas besoin d'email ni de mot de passe.
          </p>
          <div>
            <label>Pseudo (3-20 caractères)</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} autoComplete="username" required />
          </div>
          <button className="btn btn-block" disabled={busy}>
            {busy ? 'Création…' : "S'inscrire"}
          </button>
        </form>
      )}

      <p className="dim" style={{ fontSize: 12, marginTop: 16 }}>
        Votre compte est lié à votre pseudo.
      </p>
    </div>
  );
}
