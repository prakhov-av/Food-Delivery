import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, apiList } from '../api';
import { canAssignCourier, canEditItems, nextStatuses } from '../types';
import { ORDER_LIMITS } from '../config';
import type {
  OrderDto,
  OrderItemDto,
  OrderStatus,
  Role,
  UserDto,
} from '../types';
import {
  ErrorBanner,
  StatusBadge,
  SuccessBanner,
  formatDate,
  formatPrice,
  statusLabel,
} from '../ui';

const isCancel = (s: OrderStatus): boolean =>
  s === 'CANCELLED_CUSTOMER' || s === 'CANCELLED_COURIER';

const isClosed = (s?: OrderStatus): boolean =>
  s === 'COMPLETED' || s === 'CANCELLED_CUSTOMER' || s === 'CANCELLED_COURIER';

function actionLabel(target: OrderStatus): string {
  if (target === 'CREATED') return 'Отправить';
  if (target === 'ACCEPTED') return 'Оформить';
  if (isCancel(target)) return 'Отменить';

  return statusLabel(target);
}

const itemsTotal = (list: OrderItemDto[]): number =>
  list.reduce((sum, it) => sum + Number(it.menuItem.price) * it.quantity, 0);

export default function OrdersView({ role }: { role: Role }) {
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [items, setItems] = useState<OrderItemDto[]>([]);
  const [couriers, setCouriers] = useState<UserDto[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [ordersData, itemsData] = await Promise.all([
        apiList<OrderDto>('/orders'),
        apiList<OrderItemDto>('/order-items'),
      ]);

      setOrders([...ordersData].sort((a, b) => b.id - a.id));

      setItems(itemsData);

      if (canAssignCourier(role)) {
        const users = await apiList<UserDto>('/users');

        setCouriers(users.filter((u) => u.role === 'COURIER'));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось загрузить заказы',
      );
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  const itemsByOrder = useMemo(() => {
    const map = new Map<number, OrderItemDto[]>();

    for (const it of items) {
      const list = map.get(it.orderId) ?? [];

      list.push(it);
      map.set(it.orderId, list);
    }

    return map;
  }, [items]);

  // Пустой черновик NEW без позиций
  // = пустая корзина, не показываем.
  const { active, history } = useMemo(() => {
    const visible = orders.filter(
      (o) =>
        !(o.status === 'NEW' && (itemsByOrder.get(o.id)?.length ?? 0) === 0),
    );

    return {
      active: visible.filter((o) => !isClosed(o.status)),
      history: visible.filter((o) => isClosed(o.status)),
    };
  }, [orders, itemsByOrder]);

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

  const setStatus = (id: number, status: OrderStatus) => {
    if (isCancel(status) && !window.confirm(`Отменить заказ #${id}?`)) {
      return Promise.resolve();
    }

    return run(
      () =>
        api(`/orders/${id}/set-status/${status}`, {
          method: 'PATCH',
        }),
      `Заказ #${id}: ${statusLabel(status)}`,
    );
  };

  const changeCourier = (id: number, courierId: number) =>
    run(
      () =>
        api(`/orders/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            courierId,
          }),
        }),
      `Курьер заказа #${id} обновлён`,
    );

  const changeQty = (item: OrderItemDto, newQuantity: number) =>
    run(
      () =>
        api(`/order-items/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            newQuantity,
          }),
        }),
      'Количество обновлено',
    );

  const removeItem = (id: number) =>
    run(
      () =>
        api(`/order-items/${id}`, {
          method: 'DELETE',
        }),
      'Позиция удалена',
    );

  const renderOrder = (o: OrderDto) => {
    const list = itemsByOrder.get(o.id) ?? [];

    const editable = canEditItems(role, o.status);

    const next = nextStatuses(role, o.status);

    return (
      <div className="card" key={o.id} style={{ padding: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <h3>
            #{o.id} · {o.restaurant?.name ?? '—'}
          </h3>

          <StatusBadge status={o.status} />
        </div>

        <div className="muted" style={{ marginTop: 4 }}>
          Клиент: {o.customer?.name ?? '—'} · {formatDate(o.createdAt)}
        </div>

        <div style={{ marginTop: 4 }}>
          Курьер:{' '}
          {canAssignCourier(role) &&
          couriers.length > 0 &&
          !isClosed(o.status) ? (
            <select
              value={o.courier?.id ?? ''}
              onChange={(e) => {
                const id = Number(e.target.value);

                if (id) {
                  void changeCourier(o.id, id);
                }
              }}
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
        </div>

        {list.length === 0 ? (
          <div className="muted" style={{ marginTop: 8 }}>
            В заказе пока нет позиций
          </div>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '8px 0 0',
            }}
          >
            {list.map((it) => (
              <li
                key={it.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <span style={{ flex: 1 }}>{it.menuItem.name}</span>

                {editable ? (
                  <>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busy || it.quantity <= 1}
                      onClick={() => void changeQty(it, it.quantity - 1)}
                    >
                      −
                    </button>

                    <span>{it.quantity}</span>

                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={
                        busy || it.quantity >= ORDER_LIMITS.maxQuantityPerItem
                      }
                      onClick={() => void changeQty(it, it.quantity + 1)}
                    >
                      +
                    </button>
                  </>
                ) : (
                  <span>× {it.quantity}</span>
                )}

                <span className="muted">
                  {formatPrice(Number(it.menuItem.price) * it.quantity)}
                </span>

                {editable && (
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={busy}
                    onClick={() => void removeItem(it.id)}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div style={{ marginTop: 8 }}>
          <b>Итого: {formatPrice(itemsTotal(list))}</b>
        </div>

        {next.length > 0 && (
          <div className="card-actions" style={{ marginTop: 8 }}>
            {role === 'ADMIN' ? (
              <select
                className="status-select"
                value=""
                disabled={busy}
                onChange={(e) => {
                  if (e.target.value) {
                    void setStatus(o.id, e.target.value as OrderStatus);
                  }
                }}
              >
                <option value="">Сменить статус…</option>

                {next.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            ) : (
              next.map((s) => (
                <button
                  key={s}
                  className={`btn btn-sm ${
                    isCancel(s) ? 'btn-danger' : 'btn-primary'
                  }`}
                  disabled={busy || (s === 'CREATED' && list.length === 0)}
                  onClick={() => void setStatus(o.id, s)}
                >
                  {actionLabel(s)}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="view">
      <header className="view-header">
        <h1>Заказы</h1>

        <button className="btn btn-ghost" onClick={() => void load()}>
          Обновить
        </button>
      </header>

      {error && <ErrorBanner message={error} onClose={() => setError('')} />}

      {success && (
        <SuccessBanner message={success} onClose={() => setSuccess('')} />
      )}

      {loading ? (
        <div className="empty">Загрузка…</div>
      ) : active.length === 0 && history.length === 0 ? (
        <div className="empty">
          {role === 'CUSTOMER'
            ? 'Заказов пока нет. Добавьте блюда из меню ресторана.'
            : 'Заказов пока нет'}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 16,
          }}
        >
          {active.length === 0 && (
            <div className="empty">Активных заказов нет</div>
          )}

          {active.map(renderOrder)}

          {history.length > 0 && (
            <details>
              <summary
                style={{
                  cursor: 'pointer',
                  margin: '8px 0',
                }}
              >
                История ({history.length})
              </summary>

              <div
                style={{
                  display: 'grid',
                  gap: 16,
                  marginTop: 8,
                }}
              >
                {history.map(renderOrder)}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
