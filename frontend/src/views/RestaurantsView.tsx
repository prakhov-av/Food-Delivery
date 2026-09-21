import { useCallback, useEffect, useState } from 'react';
import { api, apiList } from '../api';
import type { RestaurantDto } from '../types';
import { CollapsibleForm, ErrorBanner, SuccessBanner } from '../ui';

export default function RestaurantsView() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRestaurants(await apiList<RestaurantDto>('/restaurants'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить рестораны');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(successMessage);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Операция не выполнена');
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      await api('/restaurants', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', address: '', phone: '', email: '' });
    }, 'Ресторан создан');

  const rename = (id: number) =>
    run(async () => {
      await api(`/restaurants/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ newName: renameValue }),
      });
      setRenameId(null);
    }, 'Название обновлено');

  const remove = (id: number) =>
    run(() => api(`/restaurants/${id}`, { method: 'DELETE' }), 'Ресторан деактивирован');

  return (
    <div className="view">
      <header className="view-header">
        <h1>Рестораны</h1>
        <button className="btn btn-ghost" onClick={() => void load()}>
          Обновить
        </button>
      </header>

      {error && <ErrorBanner message={error} onClose={() => setError('')} />}
      {success && <SuccessBanner message={success} onClose={() => setSuccess('')} />}

      <CollapsibleForm title="Добавить ресторан" onSubmit={create} busy={busy}>
        <label>
          Название (латиницей)
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            minLength={2}
          />
        </label>
        <label>
          Адрес
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            required
            minLength={5}
          />
        </label>
        <label>
          Телефон
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
      </CollapsibleForm>

      {loading ? (
        <div className="empty">Загрузка…</div>
      ) : restaurants.length === 0 ? (
        <div className="empty">Ресторанов пока нет</div>
      ) : (
        <div className="cards-grid">
          {restaurants.map((r) => (
            <div className="card restaurant-card" key={r.id}>
              <div className="restaurant-head">
                <h3>{r.name}</h3>
                <span className="muted">#{r.id}</span>
              </div>
              <div className="restaurant-info">
                <div>📍 {r.address}</div>
                <div>📞 {r.phone}</div>
                <div>✉️ {r.email}</div>
              </div>
              {renameId === r.id ? (
                <div className="inline-form">
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    placeholder="Новое название"
                  />
                  <button className="btn btn-primary btn-sm" onClick={() => void rename(r.id)}>
                    ОК
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setRenameId(null)}>
                    Отмена
                  </button>
                </div>
              ) : (
                <div className="card-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setRenameId(r.id);
                      setRenameValue(r.name);
                    }}
                  >
                    Переименовать
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => void remove(r.id)}
                    disabled={busy}
                  >
                    Удалить
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
