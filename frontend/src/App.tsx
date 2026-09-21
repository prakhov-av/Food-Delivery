import { useEffect, useState } from 'react';
import { api, apiList, setSessionExpiredHandler } from './api';
import AuthPage from './views/AuthPage';
import RestaurantsView from './views/RestaurantsView';
import MenusView from './views/MenusView';
import DishesView from './views/DishesView';
import OrdersView from './views/OrdersView';
import UsersView from './views/UsersView';

export interface Session {
  email: string;
  staff: boolean; // true, если доступен GET /users (роль ADMIN или MANAGER)
}

const SESSION_KEY = 'fd-session';

type ViewKey = 'restaurants' | 'menus' | 'dishes' | 'orders' | 'users';

const NAV: { key: ViewKey; label: string; icon: string; staffOnly?: boolean }[] = [
  { key: 'restaurants', label: 'Рестораны', icon: '🍽' },
  { key: 'menus', label: 'Меню', icon: '📋' },
  { key: 'dishes', label: 'Блюда', icon: '🍕' },
  { key: 'orders', label: 'Заказы', icon: '🛵' },
  { key: 'users', label: 'Пользователи', icon: '👥', staffOnly: true },
];

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [view, setView] = useState<ViewKey>('restaurants');

  useEffect(() => {
    setSessionExpiredHandler(() => {
      localStorage.removeItem(SESSION_KEY);
      setSession(null);
    });
  }, []);

  const handleLogin = async (email: string) => {
    // Роль определяем косвенно: GET /users доступен только ADMIN и MANAGER
    let staff = false;
    try {
      await apiList('/users');
      staff = true;
    } catch {
      staff = false;
    }
    const s: Session = { email, staff };
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setSession(s);
    setView('restaurants');
  };

  const handleLogout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* даже если backend недоступен — выходим локально */
    }
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  if (!session) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-mark">🍔</span>
          <span className="logo-text">
            Food<b>Delivery</b>
          </span>
        </div>
        <nav className="nav">
          {NAV.filter((n) => !n.staffOnly || session.staff).map((n) => (
            <button
              key={n.key}
              className={`nav-item ${view === n.key ? 'active' : ''}`}
              onClick={() => setView(n.key)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="session-info">
            <div className="session-email" title={session.email}>
              {session.email}
            </div>
            <div className="session-role">{session.staff ? 'Менеджер / Админ' : 'Пользователь'}</div>
          </div>
          <button className="btn btn-ghost" onClick={() => void handleLogout()}>
            Выйти
          </button>
        </div>
      </aside>
      <main className="content">
        {view === 'restaurants' && <RestaurantsView />}
        {view === 'menus' && <MenusView />}
        {view === 'dishes' && <DishesView />}
        {view === 'orders' && <OrdersView staff={session.staff} />}
        {view === 'users' && session.staff && <UsersView />}
      </main>
    </div>
  );
}
