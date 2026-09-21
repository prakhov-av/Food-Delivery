import { useCallback, useEffect, useState } from 'react';
import { api, apiList } from '../api';
import type { MenuDto, RestaurantDto } from '../types';
import { CollapsibleForm, ErrorBanner, SuccessBanner } from '../ui';

export default function MenusView() {
  const [menus, setMenus] = useState<MenuDto[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [restaurantId, setRestaurantId] = useState('');
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [menusData, restaurantsData] = await Promise.all([
        apiList<MenuDto>('/menus'),
        apiList<RestaurantDto>('/restaurants'),
      ]);
      setMenus(menusData);
      setRestaurants(restaurantsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить меню');
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
      await api('/menus', {
        method: 'POST',
        body: JSON.stringify({ name, restaurantId: Number(restaurantId) }),
      });
      setName('');
      setRestaurantId('');
    }, 'Меню создано');

  const rename = (id: number) =>
    run(async () => {
      await api(`/menus/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ newName: renameValue }),
      });
      setRenameId(null);
    }, 'Меню переименовано');

  const remove = (id: number) =>
    run(() => api(`/menus/${id}`, { method: 'DELETE' }), 'Меню деактивировано');

  return (
    <div className="view">
      <header className="view-header">
        <h1>Меню</h1>
        <button className="btn btn-ghost" onClick={() => void load()}>
          Обновить
        </button>
      </header>

      {error && <ErrorBanner message={error} onClose={() => setError('')} />}
      {success && <SuccessBanner message={success} onClose={() => setSuccess('')} />}

      <CollapsibleForm title="Добавить меню" onSubmit={create} busy={busy}>
        <label>
          Название (латиницей)
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </label>
        <label>
          Ресторан
          <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} required>
            <option value="">— выберите —</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} (#{r.id})
              </option>
            ))}
          </select>
        </label>
      </CollapsibleForm>

      {loading ? (
        <div className="empty">Загрузка…</div>
      ) : menus.length === 0 ? (
        <div className="empty">Меню пока нет</div>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th className="actions-col">Действия</th>
              </tr>
            </thead>
            <tbody>
              {menus.map((m) => (
                <tr key={m.id}>
                  <td className="muted">#{m.id}</td>
                  <td>
                    {renameId === m.id ? (
                      <div className="inline-form">
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => void rename(m.id)}
                        >
                          ОК
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setRenameId(null)}>
                          Отмена
                        </button>
                      </div>
                    ) : (
                      m.name
                    )}
                  </td>
                  <td className="actions-col">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setRenameId(m.id);
                        setRenameValue(m.name);
                      }}
                    >
                      Переименовать
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => void remove(m.id)}
                      disabled={busy}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
