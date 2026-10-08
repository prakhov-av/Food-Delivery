import { useCallback, useEffect, useState } from 'react';
import { api, apiList } from '../api';
import { canCreateOrder } from '../types';
import { ORDER_LIMITS } from '../config';
import type {
  MenuDto,
  MenuItemDto,
  OrderDto,
  RestaurantDto,
  Role,
} from '../types';
import {
  CollapsibleForm,
  ErrorBanner,
  SuccessBanner,
  formatPrice,
} from '../ui';

export default function DishesView({
  restaurant,
  menu,
  canManage,
  role,
  userId,
  onBack,
}: {
  restaurant: RestaurantDto;
  menu: MenuDto;
  canManage: boolean;
  role: Role;
  userId: number;
  onBack: () => void;
}) {
  const [items, setItems] = useState<MenuItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
  });

  const [editId, setEditId] = useState<number | null>(null);

  const [edit, setEdit] = useState({
    newName: '',
    newDescription: '',
    newPrice: '',
  });

  const [qty, setQty] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setItems(await api<MenuItemDto[]>(`/menu-items?menuId=${menu.id}`));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось загрузить блюда',
      );
    } finally {
      setLoading(false);
    }
  }, [menu.id]);

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
          menuId: menu.id,
        }),
      });

      setForm({
        name: '',
        description: '',
        price: '',
      });
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
    run(
      () =>
        api(`/menu-items/${id}`, {
          method: 'DELETE',
        }),
      'Блюдо деактивировано',
    );

  // Корзина = заказ в статусе NEW в этом ресторане.
  // Создаётся при первом добавлении.
  const addToOrder = (item: MenuItemDto) =>
    run(async () => {
      const quantity = Math.min(
        ORDER_LIMITS.maxQuantityPerItem,
        Math.max(1, Math.floor(Number(qty[item.id] ?? '1')) || 1),
      );

      const orders = await apiList<OrderDto>('/orders');

      let order = orders.find(
        (o) => o.status === 'NEW' && o.restaurant?.id === restaurant.id,
      );

      if (!order) {
        order = await api<OrderDto>('/orders', {
          method: 'POST',
          body: JSON.stringify({
            customerId: userId,
            restaurantId: restaurant.id,
          }),
        });
      }

      await api('/order-items', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order.id,
          menuItemId: item.id,
          quantity,
        }),
      });

      setQty({
        ...qty,
        [item.id]: '1',
      });
    }, `«${item.name}» добавлено в заказ`);

  return (
    <div className="view">
      <header className="view-header view-header-redesign">
        <div className="view-header-main">
          <button className="view-back-link" onClick={onBack}>
            ← К меню {restaurant.name}
          </button>

          <h1>Блюда · {menu.name}</h1>
        </div>

        <div className="view-header-actions">
          <button
            className="btn btn-ghost view-refresh-button"
            onClick={() => void load()}
          >
            Обновить
          </button>
        </div>
      </header>

      {error && <ErrorBanner message={error} onClose={() => setError('')} />}

      {success && (
        <SuccessBanner message={success} onClose={() => setSuccess('')} />
      )}

      {canManage && (
        <CollapsibleForm title="Добавить блюдо" onSubmit={create} busy={busy}>
          <label>
            Название (латиницей)
            <input
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                })
              }
              required
              minLength={2}
            />
          </label>

          <label>
            Описание
            <input
              value={form.description}
              onChange={(e) =>
                setForm({
                  ...form,
                  description: e.target.value,
                })
              }
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
              onChange={(e) =>
                setForm({
                  ...form,
                  price: e.target.value,
                })
              }
              required
            />
          </label>
        </CollapsibleForm>
      )}

      {loading ? (
        <div className="empty">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="empty">В этом меню пока нет блюд</div>
      ) : (
        <div className="cards-grid dishes-grid">
          {items.map((item) =>
            canManage && editId === item.id ? (
              <div className="card dish-card" key={item.id}>
                <div className="form-grid">
                  <label>
                    Название
                    <input
                      value={edit.newName}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          newName: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Описание
                    <input
                      value={edit.newDescription}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          newDescription: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Цена
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={edit.newPrice}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          newPrice: e.target.value,
                        })
                      }
                    />
                  </label>

                  <div className="inline-form">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => void saveEdit(item.id)}
                    >
                      Сохранить
                    </button>

                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditId(null)}
                    >
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

                {canCreateOrder(role) && (
                  <div className="inline-form">
                    <input
                      type="number"
                      min="1"
                      max={ORDER_LIMITS.maxQuantityPerItem}
                      className="qty-input"
                      value={qty[item.id] ?? '1'}
                      onChange={(e) =>
                        setQty({
                          ...qty,
                          [item.id]: e.target.value,
                        })
                      }
                    />

                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => void addToOrder(item)}
                    >
                      В заказ
                    </button>
                  </div>
                )}

                {canManage && (
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
                )}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
