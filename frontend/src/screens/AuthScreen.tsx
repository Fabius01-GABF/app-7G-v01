import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { api, ApiErrorImpl } from '../lib/api';

type Tab = 'login' | 'register' | 'forgot';

export function AuthScreen() {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<Tab>('login');
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [confirm, setConfirm] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    setInfo(null);
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
    void run(() => login(identifier, password));
  };

  const onRegister = (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setErr('Mot de passe : 8 caractères minimum.');
      return;
    }
    if (password !== confirm) {
      setErr('Les mots de passe ne correspondent pas.');
      return;
    }
    void run(() =>
      register({
        username,
        email,
        password,
        security_question: securityQuestion || undefined,
        security_answer: securityAnswer || undefined,
      }),
    );
  };

  const onForgot = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ identifier, security_answer: securityAnswer, new_password: password }),
      });
      setInfo('Mot de passe réinitialisé. Vous pouvez vous connecter.');
      setTab('login');
      setPassword('');
    });
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
        {tabBtn('forgot', 'Récupération')}
      </div>

      {err && <div className="error-box">{err}</div>}
      {info && <div className="ok-box">{info}</div>}

      {tab === 'login' && (
        <form className="card col" onSubmit={onLogin}>
          <div>
            <label>Pseudo ou email</label>
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required />
          </div>
          <div>
            <label>Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          <button className="btn btn-block" disabled={busy}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      )}

      {tab === 'register' && (
        <form className="card col" onSubmit={onRegister}>
          <div>
            <label>Pseudo (3-20 caractères)</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label>Mot de passe (8+ caractères)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          </div>
          <div>
            <label>Confirmer le mot de passe</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </div>
          <div>
            <label>Question de sécurité (pour récupérer le compte)</label>
            <input value={securityQuestion} onChange={(e) => setSecurityQuestion(e.target.value)} placeholder="ex : Animal préféré ?" />
          </div>
          <div>
            <label>Réponse à la question</label>
            <input value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} />
          </div>
          <button className="btn btn-block" disabled={busy}>
            {busy ? 'Création…' : "S'inscrire"}
          </button>
        </form>
      )}

      {tab === 'forgot' && (
        <form className="card col" onSubmit={onForgot}>
          <p className="dim" style={{ fontSize: 13 }}>
            Entrez votre pseudo/email, votre réponse de sécurité et un nouveau mot de passe.
          </p>
          <div>
            <label>Pseudo ou email</label>
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          </div>
          <div>
            <label>Réponse de sécurité</label>
            <input value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} required />
          </div>
          <div>
            <label>Nouveau mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-block" disabled={busy}>
            {busy ? 'Réinitialisation…' : 'Réinitialiser'}
          </button>
        </form>
      )}

      <p className="dim" style={{ fontSize: 12, marginTop: 16 }}>
        L’API utilise le serveur local défini par <code>VITE_API_URL</code> (défaut http://localhost:3000).
      </p>
    </div>
  );
}
