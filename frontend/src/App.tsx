import { useEffect, useState } from 'react';
import { api, setSessionExpiredHandler } from './api';
import { canManageCatalog } from './types';
import type { MenuDto, RestaurantDto, Role, UserDto } from './types';
import AuthPage from './views/AuthPage';
import RestaurantsView from './views/RestaurantsView';
import MenusView from './views/MenusView';
import DishesView from './views/DishesView';
import OrdersView from './views/OrdersView';
import UsersView from './views/UsersView';
import AuditView from './views/AuditView';
import ChatWidget from './ChatWidget';

type ViewKey = 'restaurants' | 'orders' | 'users' | 'audit';

const NAV: {
  key: ViewKey;
  label: string;
  icon: string;
  adminOnly?: boolean;
}[] = [
  { key: 'restaurants', label: 'Рестораны', icon: '🍽' },
  { key: 'orders', label: 'Заказы', icon: '🛵' },
  { key: 'users', label: 'Пользователи', icon: '👥', adminOnly: true },
  { key: 'audit', label: 'Журнал', icon: '📜', adminOnly: true },
];

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Админ',
  MANAGER: 'Менеджер',
  CUSTOMER: 'Клиент',
  COURIER: 'Курьер',
};

export default function App() {
  const [user, setUser] = useState<UserDto | null>(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState<ViewKey>('restaurants');
  const [restaurant, setRestaurant] = useState<RestaurantDto | null>(null);
  const [menu, setMenu] = useState<MenuDto | null>(null);

  const resetCatalog = () => {
    setRestaurant(null);
    setMenu(null);
  };

  const openView = (key: ViewKey) => {
    setView(key);
    resetCatalog();
  };

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      resetCatalog();
    });
    api<UserDto>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  const handleLogin = async () => {
    setUser(await api<UserDto>('/auth/me'));
    openView('restaurants');
  };

  const handleLogout = async () => {
    try {
      await api('/chat', { method: 'DELETE' });
    } catch {
      /* история чата не критична для выхода */
    }
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* даже если backend недоступен — выходим локально */
    }
    setUser(null);
    resetCatalog();
  };

  if (checking) return <div className="empty">Загрузка…</div>;
  if (!user) return <AuthPage onLogin={handleLogin} />;

  const canManage = canManageCatalog(user.role);
  const isAdmin = user.role === 'ADMIN';

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
          {NAV.filter((n) => !n.adminOnly || isAdmin).map((n) => (
            <button
              key={n.key}
              className={`nav-item ${view === n.key ? 'active' : ''}`}
              onClick={() => openView(n.key)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="session-info">
            <div className="session-email" title={user.name}>
              {user.name}
            </div>
            <div className="session-role">{ROLE_LABELS[user.role]}</div>
          </div>
          <button className="btn btn-ghost" onClick={() => void handleLogout()}>
            Выйти
          </button>
        </div>
      </aside>
      <main className="content">
        {view === 'restaurants' && !restaurant && (
          <RestaurantsView
            canManage={canManage}
            onSelect={(r) => {
              setRestaurant(r);
              setMenu(null);
            }}
          />
        )}
        {view === 'restaurants' && restaurant && !menu && (
          <MenusView
            restaurant={restaurant}
            canManage={canManage}
            onSelect={setMenu}
            onBack={resetCatalog}
          />
        )}
        {view === 'restaurants' && restaurant && menu && (
          <DishesView
            restaurant={restaurant}
            menu={menu}
            canManage={canManage}
            role={user.role}
            userId={user.id}
            onBack={() => setMenu(null)}
          />
        )}
        {view === 'orders' && <OrdersView role={user.role} />}
        {view === 'users' && isAdmin && <UsersView />}
        {view === 'audit' && isAdmin && <AuditView />}
      </main>
      <ChatWidget role={user.role} />
    </div>
  );
}
