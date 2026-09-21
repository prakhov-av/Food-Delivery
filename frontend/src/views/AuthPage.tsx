import { useState, type FormEvent } from 'react';
import { api } from '../api';

type Tab = 'login' | 'register' | 'confirm';

export default function AuthPage({ onLogin }: { onLogin: (email: string) => Promise<void> }) {
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('admin@delivery.dev');
  const [password, setPassword] = useState('Qwerty123');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

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
      const message = await api<string>('/users/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, phone }),
      });
      setInfo(typeof message === 'string' ? message : 'Проверьте почту для подтверждения');
      setTab('confirm');
    });
  };

  const handleConfirm = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api<string>(`/users/confirm/${encodeURIComponent(code)}`);
      setInfo('Регистрация подтверждена — теперь можно войти');
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
          <button className={`tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
            Вход
          </button>
          <button
            className={`tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => setTab('register')}
          >
            Регистрация
          </button>
          <button
            className={`tab ${tab === 'confirm' ? 'active' : ''}`}
            onClick={() => setTab('confirm')}
          >
            Код
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
                required
              />
            </label>
            <label>
              Пароль
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
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
              <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
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

        {tab === 'confirm' && (
          <form className="form-grid" onSubmit={handleConfirm}>
            <label>
              Код подтверждения из письма
              <input value={code} onChange={(e) => setCode(e.target.value)} required />
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? '…' : 'Подтвердить'}
            </button>
          </form>
        )}

        <div className="auth-hint">
          Тестовые аккаунты (пароль <code>Qwerty123</code>):
          <br />
          <code>admin@delivery.dev</code> · <code>manager@delivery.dev</code>
          <br />
          <code>anna@example.com</code> · <code>courier1@delivery.dev</code>
        </div>
      </div>
    </div>
  );
}
