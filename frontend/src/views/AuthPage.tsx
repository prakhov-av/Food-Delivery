import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';

type Tab = 'login' | 'register';

export default function AuthPage({
  onLogin,
}: {
  onLogin: (email: string) => Promise<void>;
}) {
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
      .then(() => setInfo('Регистрация подтверждена — теперь можно войти'))
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : 'Не удалось подтвердить регистрацию',
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
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
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

      setInfo('Ссылка подтверждения отправлена на почту');
      setTab('login');
    });
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card card">
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
            Вход
          </button>

          <button
            className={`tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => setTab('register')}
          >
            Регистрация
          </button>
        </div>

        {error && <div className="banner banner-error">{error}</div>}

        {info && <div className="banner banner-success">{info}</div>}

        {tab === 'login' && (
          <form className="form-grid" onSubmit={handleLogin}>
            <label>
              Email
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
              Пароль
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={import.meta.env.DEV ? 'Qwerty123' : ''}
                required
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? '…' : 'Войти'}
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form className="form-grid" onSubmit={handleRegister}>
            <label>
              Имя (латиницей)
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label>
              Телефон
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </label>

            <label>
              Пароль (8–20, буквы обоих регистров и цифра)
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? '…' : 'Зарегистрироваться'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
