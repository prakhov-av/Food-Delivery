import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { MenuDto, RestaurantDto } from '../types';
import { CollapsibleForm, ErrorBanner, SuccessBanner } from '../ui';

export default function MenusView({
  restaurant,
  canManage,
  onSelect,
  onBack,
}: {
  restaurant: RestaurantDto;
  canManage: boolean;
  onSelect: (menu: MenuDto) => void;
  onBack: () => void;
}) {
  const [menus, setMenus] = useState<MenuDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setMenus(await api<MenuDto[]>(`/menus?restaurantId=${restaurant.id}`));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось загрузить меню',
      );
    } finally {
      setLoading(false);
    }
  }, [restaurant.id]);

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
        body: JSON.stringify({ name, restaurantId: restaurant.id }),
      });
      setName('');
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
        <div>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            ← К ресторанам
          </button>
          <h1>Меню · {restaurant.name}</h1>
        </div>
        <button className="btn btn-ghost" onClick={() => void load()}>
          Обновить
        </button>
      </header>

      {error && <ErrorBanner message={error} onClose={() => setError('')} />}
      {success && (
        <SuccessBanner message={success} onClose={() => setSuccess('')} />
      )}

      {canManage && (
        <CollapsibleForm title="Добавить меню" onSubmit={create} busy={busy}>
          <label>
            Название (латиницей)
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </label>
        </CollapsibleForm>
      )}

      {loading ? (
        <div className="empty">Загрузка…</div>
      ) : menus.length === 0 ? (
        <div className="empty">У этого ресторана пока нет меню</div>
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
                    {canManage && renameId === m.id ? (
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
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setRenameId(null)}
                        >
                          Отмена
                        </button>
                      </div>
                    ) : (
                      m.name
                    )}
                  </td>
                  <td className="actions-col">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onSelect(m)}
                    >
                      Блюда →
                    </button>
                    {canManage && (
                      <>
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
                      </>
                    )}
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
