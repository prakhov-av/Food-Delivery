import { useCallback, useEffect, useState } from 'react';
import { api, apiList } from '../api';
import type { MenuItemDto, OrderDto, OrderStatus, RestaurantDto, UserDto } from '../types';
import { ORDER_STATUSES } from '../types';
import {
  CollapsibleForm,
  ErrorBanner,
  StatusBadge,
  SuccessBanner,
  formatDate,
  formatPrice,
  statusLabel,
} from '../ui';

export default function OrdersView({ staff }: { staff: boolean }) {
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ customerId: '', courierId: '', restaurantId: '' });
  const [itemOrderId, setItemOrderId] = useState<number | null>(null);
  const [itemForm, setItemForm] = useState({ menuItemId: '', quantity: '1' });

  const customers = users.filter((u) => u.role === 'CUSTOMER');
  const couriers = users.filter((u) => u.role === 'COURIER');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ordersData, restaurantsData, menuItemsData] = await Promise.all([
        apiList<OrderDto>('/orders'),
        apiList<RestaurantDto>('/restaurants'),
        apiList<MenuItemDto>('/menu-items'),
      ]);
      setOrders(ordersData);
      setRestaurants(restaurantsData);
      setMenuItems(menuItemsData);
      if (staff) {
        setUsers(await apiList<UserDto>('/users'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить заказы');
    } finally {
      setLoading(false);
    }
  }, [staff]);

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
      await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerId: Number(form.customerId),
          courierId: Number(form.courierId),
          restaurantId: Number(form.restaurantId),
        }),
      });
      setForm({ customerId: '', courierId: '', restaurantId: '' });
    }, 'Заказ создан. Теперь добавьте позиции.');

  const setStatus = (id: number, status: OrderStatus) =>
    run(
      () => api(`/orders/${id}/set-status/${status}`, { method: 'PATCH' }),
      `Статус заказа #${id}: ${statusLabel(status)}`,
    );

  const changeCourier = (id: number, courierId: number) =>
    run(
      () =>
        api(`/orders/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ courierId }),
        }),
      `Курьер заказа #${id} обновлён`,
    );

  const addItem = (orderId: number) =>
    run(async () => {
      await api('/order-items', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          menuItemId: Number(itemForm.menuItemId),
          quantity: Number(itemForm.quantity),
        }),
      });
      setItemForm({ menuItemId: '', quantity: '1' });
      setItemOrderId(null);
    }, `Позиция добавлена в заказ #${orderId}`);

  return (
    <div className="view">
      <header className="view-header">
        <h1>Заказы</h1>
        <button className="btn btn-ghost" onClick={() => void load()}>
          Обновить
        </button>
      </header>

      {error && <ErrorBanner message={error} onClose={() => setError('')} />}
      {success && <SuccessBanner message={success} onClose={() => setSuccess('')} />}

      <CollapsibleForm title="Оформить заказ" onSubmit={create} busy={busy}>
        <label>
          Клиент
          {staff ? (
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              required
            >
              <option value="">— выберите —</option>
              {customers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} (#{u.id})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              min="1"
              placeholder="ID клиента"
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              required
            />
          )}
        </label>
        <label>
          Курьер
          {staff ? (
            <select
              value={form.courierId}
              onChange={(e) => setForm({ ...form, courierId: e.target.value })}
              required
            >
              <option value="">— выберите —</option>
              {couriers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} (#{u.id})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              min="1"
              placeholder="ID курьера"
              value={form.courierId}
              onChange={(e) => setForm({ ...form, courierId: e.target.value })}
              required
            />
          )}
        </label>
        <label>
          Ресторан
          <select
            value={form.restaurantId}
            onChange={(e) => setForm({ ...form, restaurantId: e.target.value })}
            required
          >
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
      ) : orders.length === 0 ? (
        <div className="empty">Заказов пока нет</div>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Клиент</th>
                <th>Ресторан</th>
                <th>Курьер</th>
                <th>Сумма</th>
                <th>Создан</th>
                <th>Статус</th>
                <th className="actions-col">Действия</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="muted">#{o.id}</td>
                  <td>{o.customer?.name ?? '—'}</td>
                  <td>{o.restaurant?.name ?? '—'}</td>
                  <td>
                    {staff && couriers.length > 0 ? (
                      <select
                        value={o.courier?.id ?? ''}
                        onChange={(e) => void changeCourier(o.id, Number(e.target.value))}
                        disabled={busy}
                      >
                        {!o.courier && <option value="">—</option>}
                        {couriers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      (o.courier?.name ?? '—')
                    )}
                  </td>
                  <td>{formatPrice(o.totalPrice)}</td>
                  <td className="muted">{formatDate(o.createdAt)}</td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="actions-col">
                    <select
                      className="status-select"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          void setStatus(o.id, e.target.value as OrderStatus);
                        }
                      }}
                      disabled={busy}
                    >
                      <option value="">Сменить статус…</option>
                      {ORDER_STATUSES.filter((s) => s !== o.status).map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setItemOrderId(itemOrderId === o.id ? null : o.id);
                        setItemForm({ menuItemId: '', quantity: '1' });
                      }}
                    >
                      + Позиция
                    </button>
                    {itemOrderId === o.id && (
                      <div className="inline-form item-form">
                        <select
                          value={itemForm.menuItemId}
                          onChange={(e) =>
                            setItemForm({ ...itemForm, menuItemId: e.target.value })
                          }
                        >
                          <option value="">— блюдо —</option>
                          {menuItems.map((mi) => (
                            <option key={mi.id} value={mi.id}>
                              {mi.name} · {formatPrice(mi.price)}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          className="qty-input"
                          value={itemForm.quantity}
                          onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={busy || !itemForm.menuItemId}
                          onClick={() => void addItem(o.id)}
                        >
                          ОК
                        </button>
                      </div>
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
