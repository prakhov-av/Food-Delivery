import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { useT } from '../i18n';
import LanguageSwitch from '../i18n/LanguageSwitch';

type Tab = 'login' | 'register';

export default function AuthPage({
  onLogin,
  onGuest,
}: {
  onLogin: (email: string) => Promise<void>;
  onGuest: () => Promise<void>;
}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);


  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('confirm');
    if (!code) return;

    window.history.replaceState(null, '', window.location.pathname);
    setBusy(true);
    api<string>(`/users/confirm/${encodeURIComponent(code)}`)
      .then(() => setInfo(t('views.auth.confirmed')))
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : t('views.auth.confirmFailed'),
        ),
      )
      .finally(() => setBusy(false));
  }, []);

  const run = async (action: () => Promise<void>) => {
    setError('');
    setInfo('');
    setBusy(true);

    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('views.auth.somethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();

    void run(async () => {
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      await onLogin(email);
    });
  };

  const handleRegister = (e: FormEvent) => {
    e.preventDefault();

    void run(async () => {
      await api('/users/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, phone }),
      });

      setInfo(t('views.auth.confirmLinkSent'));
      setTab('login');
    });
  };

  const handleGuest = () => {
    void run(async () => {
      await onGuest();
    });
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        {/*
          Переключатель языка на экране входа: иначе язык нельзя сменить
          до входа, а интерфейс всегда стартует с английского.
        */}
        <div className="auth-lang">
          <LanguageSwitch />
        </div>

        <div className="logo auth-logo">
          <span className="logo-mark">🍔</span>

          <span className="logo-text">
            Food<b>Delivery</b>
          </span>
        </div>

        <div className="tabs">
          <button
            className={`tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => setTab('login')}
          >
            {t('views.auth.tabLogin')}
          </button>

          <button
            className={`tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => setTab('register')}
          >
            {t('views.auth.tabRegister')}
          </button>
        </div>

        {error && <div className="banner banner-error">{error}</div>}

        {info && <div className="banner banner-success">{info}</div>}

        {tab === 'login' && (
          <form className="form-grid" onSubmit={handleLogin}>
            <label>
              {t('views.auth.email')}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  import.meta.env.DEV
                    ? 'admin@delivery.dev'
                    : 'name@example.com'
                }
                required
              />
            </label>
            <label>
              {t('views.auth.password')}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={import.meta.env.DEV ? 'Qwerty123' : ''}
                required
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? '…' : t('views.auth.login')}
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form className="form-grid" onSubmit={handleRegister}>
            <label>
              {t('views.auth.nameLatin')}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
            </label>

            <label>
              {t('views.auth.email')}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label>
              {t('views.auth.phone')}
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </label>

            <label>
              {t('views.auth.passwordHint')}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? '…' : t('views.auth.register')}
            </button>
          </form>
        )}

        <div className="guest-entry">
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy}
            onClick={handleGuest}
          >
            {busy ? '…' : t('views.auth.continueAsGuest')}
          </button>

          <div className="auth-hint">
            {t('views.auth.guestHint')}
          </div>
        </div>
      </div>
    </div>
  );
}
