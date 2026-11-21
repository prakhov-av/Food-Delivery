import { useEffect, useState } from 'react';
import { api, setSessionExpiredHandler } from './api';
import { canManageCatalog, canUploadDocs } from './types';
import type {
  AccessMode,
  MenuDto,
  RestaurantDto,
  Role,
  UserDto,
} from './types';
import {
  createGuestSession,
  getGuestSession,
  revokeGuestSession,
} from './guest';
import AuthPage from './views/AuthPage';
import RestaurantsView from './views/RestaurantsView';
import MenusView from './views/MenusView';
import DishesView from './views/DishesView';
import OrdersView from './views/OrdersView';
import GuestOrdersView from './views/GuestOrdersView';
import UsersView from './views/UsersView';
import AuditView from './views/AuditView';
import UploadView from './views/UploadView.tsx';
import ChatWidget from './ChatWidget';
import LanguageSwitch from './i18n/LanguageSwitch';
import { useLang, useT } from './i18n';

type ViewKey = 'restaurants' | 'orders' | 'users' | 'audit' | 'upload';

const NAV: {
  key: ViewKey;
  labelKey: string;
  icon: string;
  adminOnly?: boolean;
}[] = [
  { key: 'restaurants', labelKey: 'nav.restaurants', icon: '🍽' },
  { key: 'orders', labelKey: 'nav.orders', icon: '🛵' },
  { key: 'users', labelKey: 'nav.users', icon: '👥', adminOnly: true },
  { key: 'audit', labelKey: 'nav.audit', icon: '📜', adminOnly: true },
  { key: 'upload', labelKey: 'nav.upload', icon: '📄', adminOnly: true },
];

const ROLE_LABEL_KEYS: Record<Role, string> = {
  ADMIN: 'role.admin',
  MANAGER: 'role.manager',
  CUSTOMER: 'role.customer',
  COURIER: 'role.courier',
};

export default function App() {
  const t = useT();
  const lang = useLang();

  // Гость — отдельный режим доступа, а не зарегистрированный CUSTOMER.
  const [mode, setMode] = useState<AccessMode>('anon');
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
      setMode('anon');
      resetCatalog();
    });

    /**
     * Восстановление режима доступа после перезагрузки страницы.
     *
     * Приоритет такой же, как на backend: сначала проверяется JWT,
     * и только при его отсутствии — гостевая cookie.
     *
     * Обе проверки идут параллельно: гостевая сессия нужна только тогда,
     * когда JWT нет, но ждать её последовательно значит добавить
     * целый круговой обход к первому отрисовке.
     */
    const restore = async () => {
      const [meResult, guestResult] = await Promise.allSettled([
        api<UserDto>('/auth/me'),
        getGuestSession(),
      ]);

      if (meResult.status === 'fulfilled') {
        setUser(meResult.value);
        setMode('user');
        setChecking(false);

        return;
      }

      // getGuestSession() не бросает исключение, а возвращает null,
      // поэтому смотрим на значение, а не на статус промиса.
      const guestSession =
        guestResult.status === 'fulfilled' ? guestResult.value : null;

      setMode(guestSession ? 'guest' : 'anon');
      setChecking(false);
    };

    void restore();
  }, []);

  const handleLogin = async () => {
    setUser(await api<UserDto>('/auth/me'));
    setMode('user');
    openView('restaurants');
  };

  const handleGuestLogin = async () => {
    await createGuestSession();
    setMode('guest');
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
    setMode('anon');
    resetCatalog();
  };

  const handleGuestLogout = async () => {
    await revokeGuestSession();
    setMode('anon');
    resetCatalog();
  };

  if (checking) return <div className="empty">{t('app.loading')}</div>;
  if (mode === 'anon') {
    return <AuthPage onLogin={handleLogin} onGuest={handleGuestLogin} />;
  }

  const isGuest = mode === 'guest';

  // Гость работает с каталогом и своими заказами, без админских разделов.
  const role: Role = user?.role ?? 'CUSTOMER';
  const canManage = canManageCatalog(role);
  const isAdmin = role === 'ADMIN';

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
              {n.key === 'orders' && isGuest ? t('nav.myOrders') : t(n.labelKey)}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="session-info">
            <div className="session-email" title={user?.name}>
              {isGuest ? t('session.guest') : user?.name}
            </div>
            <div className="session-role">
              {isGuest ? t('session.guestMode') : t(ROLE_LABEL_KEYS[role])}
            </div>
          </div>
          <LanguageSwitch compact />
          <button
            className="btn btn-ghost"
            onClick={() =>
              void (isGuest ? handleGuestLogout() : handleLogout())
            }
          >
            {t('action.logout')}
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
            role={role}
            userId={user?.id ?? 0}
            isGuest={isGuest}
            onBack={() => setMenu(null)}
          />
        )}
        {view === 'orders' &&
          (isGuest ? <GuestOrdersView /> : <OrdersView role={role} />)}
        {view === 'users' && isAdmin && <UsersView />}
        {view === 'audit' && isAdmin && <AuditView />}
        {view === 'upload' && canUploadDocs(role) && <UploadView />}
      </main>
      <ChatWidget role={role} lang={lang} />
    </div>
  );
}
