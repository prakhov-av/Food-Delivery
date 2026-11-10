import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getGuestOrders,
  removeGuestOrderItem,
  setGuestOrderStatus,
  updateGuestOrderItem,
} from '../guest';
import { guestNextStatuses } from '../types';
import type { GuestOrderDto, OrderStatus } from '../types';
import {
  ErrorBanner,
  StatusBadge,
  SuccessBanner,
  formatDate,
  formatPrice,
  statusLabel,
} from '../ui';

const itemsTotal = (guestOrder: GuestOrderDto): number =>
  guestOrder.items.reduce(
    (sum, item) => sum + Number(item.menuItem.price) * item.quantity,
    0,
  );

/**
 * Заказы гостевой сессии.
 *
 * Гость сам выбирает статус заказа: это позволяет ассистенту
 * отвечать по фактическому состоянию заказа.
 */
export default function GuestOrdersView() {
  const [orders, setOrders] = useState<GuestOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setOrders(await getGuestOrders());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось загрузить заказы',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (
    action: () => Promise<GuestOrderDto>,
    successMessage: string,
  ) => {
    setBusy(true);
    setError('');
    setSuccess('');

    try {
      const updated = await action();

      setOrders((current) =>
        current.map((guestOrder) =>
          guestOrder.order.id === updated.order.id ? updated : guestOrder,
        ),
      );

      setSuccess(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Операция не выполнена');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (orderId: number, status: OrderStatus) =>
    run(
      () => setGuestOrderStatus(orderId, status),
      `Заказ #${orderId}: ${statusLabel(status)}`,
    );

  const changeQty = (guestOrder: GuestOrderDto, itemId: number, quantity: number) =>
    run(
      () => updateGuestOrderItem(guestOrder.order.id, itemId, quantity),
      'Количество обновлено',
    );

  const removeItem = (guestOrder: GuestOrderDto, itemId: number) =>
    run(
      () => removeGuestOrderItem(guestOrder.order.id, itemId),
      'Позиция удалена',
    );

  const { active, history } = useMemo(() => {
    const visible = orders.filter(
      (guestOrder) =>
        !(
          guestOrder.order.status === 'NEW' &&
          guestOrder.items.length === 0
        ),
    );

    return {
      active: visible.filter(
        (guestOrder) => guestOrder.order.status !== 'COMPLETED',
      ),
      history: visible.filter(
        (guestOrder) => guestOrder.order.status === 'COMPLETED',
      ),
    };
  }, [orders]);

  const renderOrder = (guestOrder: GuestOrderDto) => {
    const order = guestOrder.order;
    const list = guestOrder.items;
    const editable = order.status === 'NEW';
    const next = guestNextStatuses(order.status);

    return (
      <div className="card" key={order.id} style={{ padding: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <h3>
            #{order.id} · {order.restaurant?.name ?? '—'}
          </h3>

          <StatusBadge status={order.status} />
        </div>

        <div className="muted" style={{ marginTop: 4 }}>
          Гость · {formatDate(order.createdAt)}
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
            {list.map((item) => (
              <li
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <span style={{ flex: 1 }}>{item.menuItem.name}</span>

                {editable ? (
                  <>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busy || item.quantity <= 1}
                      onClick={() =>
                        void changeQty(guestOrder, item.id, item.quantity - 1)
                      }
                    >
                      −
                    </button>

                    <span>{item.quantity}</span>

                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() =>
                        void changeQty(guestOrder, item.id, item.quantity + 1)
                      }
                    >
                      +
                    </button>
                  </>
                ) : (
                  <span>× {item.quantity}</span>
                )}

                <span className="muted">
                  {formatPrice(Number(item.menuItem.price) * item.quantity)}
                </span>

                {editable && (
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={busy}
                    onClick={() => void removeItem(guestOrder, item.id)}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div style={{ marginTop: 8 }}>
          <b>Итого: {formatPrice(itemsTotal(guestOrder))}</b>
        </div>

        {next.length > 0 && (
          <div className="card-actions" style={{ marginTop: 8 }}>
            {next.map((status) => (
              <button
                key={status}
                className="btn btn-primary btn-sm"
                disabled={busy || (status === 'ACCEPTED' && list.length === 0)}
                onClick={() => void changeStatus(order.id, status)}
              >
                {statusLabel(status)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="view">
      <header className="view-header">
        <h1>Мои заказы</h1>

        <button
          className="btn btn-ghost"
          onClick={() => void load()}
          disabled={loading || busy}
        >
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
          Заказов пока нет. Добавьте блюда из меню ресторана.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {active.length === 0 && (
            <div className="empty">Активных заказов нет</div>
          )}

          {active.map(renderOrder)}

          {history.length > 0 && (
            <details>
              <summary style={{ cursor: 'pointer', margin: '8px 0' }}>
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
