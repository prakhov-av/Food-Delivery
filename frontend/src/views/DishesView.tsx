import { useCallback, useEffect, useState } from 'react';
import { api, apiList } from '../api';
import type { MenuDto, MenuItemDto } from '../types';
import { CollapsibleForm, ErrorBanner, SuccessBanner, formatPrice } from '../ui';

export default function DishesView() {
  const [items, setItems] = useState<MenuItemDto[]>([]);
  const [menus, setMenus] = useState<MenuDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ name: '', description: '', price: '', menuId: '' });
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState({ newName: '', newDescription: '', newPrice: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [itemsData, menusData] = await Promise.all([
        apiList<MenuItemDto>('/menu-items'),
        apiList<MenuDto>('/menus'),
      ]);
      setItems(itemsData);
      setMenus(menusData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить блюда');
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
      await api('/menu-items', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          price: Number(form.price),
          menuId: Number(form.menuId),
        }),
      });
      setForm({ name: '', description: '', price: '', menuId: '' });
    }, 'Блюдо добавлено');

  const saveEdit = (id: number) =>
    run(async () => {
      await api(`/menu-items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          newName: edit.newName,
          newDescription: edit.newDescription,
          newPrice: Number(edit.newPrice),
        }),
      });
      setEditId(null);
    }, 'Блюдо обновлено');

  const remove = (id: number) =>
    run(() => api(`/menu-items/${id}`, { method: 'DELETE' }), 'Блюдо деактивировано');

  return (
    <div className="view">
      <header className="view-header">
        <h1>Блюда</h1>
        <button className="btn btn-ghost" onClick={() => void load()}>
          Обновить
        </button>
      </header>

      {error && <ErrorBanner message={error} onClose={() => setError('')} />}
      {success && <SuccessBanner message={success} onClose={() => setSuccess('')} />}

      <CollapsibleForm title="Добавить блюдо" onSubmit={create} busy={busy}>
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
          Описание
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            minLength={2}
          />
        </label>
        <label>
          Цена, ₽
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />
        </label>
        <label>
          Меню
          <select
            value={form.menuId}
            onChange={(e) => setForm({ ...form, menuId: e.target.value })}
            required
          >
            <option value="">— выберите —</option>
            {menus.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} (#{m.id})
              </option>
            ))}
          </select>
        </label>
      </CollapsibleForm>

      {loading ? (
        <div className="empty">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="empty">Блюд пока нет</div>
      ) : (
        <div className="cards-grid dishes-grid">
          {items.map((item) =>
            editId === item.id ? (
              <div className="card dish-card" key={item.id}>
                <div className="form-grid">
                  <label>
                    Название
                    <input
                      value={edit.newName}
                      onChange={(e) => setEdit({ ...edit, newName: e.target.value })}
                    />
                  </label>
                  <label>
                    Описание
                    <input
                      value={edit.newDescription}
                      onChange={(e) => setEdit({ ...edit, newDescription: e.target.value })}
                    />
                  </label>
                  <label>
                    Цена
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={edit.newPrice}
                      onChange={(e) => setEdit({ ...edit, newPrice: e.target.value })}
                    />
                  </label>
                  <div className="inline-form">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => void saveEdit(item.id)}
                    >
                      Сохранить
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>
                      Отмена
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card dish-card" key={item.id}>
                <div className="dish-head">
                  <h3>{item.name}</h3>
                  <span className="dish-price">{formatPrice(item.price)}</span>
                </div>
                <p className="dish-description">{item.description}</p>
                <div className="card-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditId(item.id);
                      setEdit({
                        newName: item.name,
                        newDescription: item.description,
                        newPrice: String(item.price),
                      });
                    }}
                  >
                    Изменить
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => void remove(item.id)}
                    disabled={busy}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
