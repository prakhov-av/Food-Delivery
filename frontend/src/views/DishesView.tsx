import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { api, apiList } from '../api';
import {
  addGuestOrderItem,
  getGuestOrders,
  getOrCreateGuestOrder,
} from '../guest';
import { canCreateOrder } from '../types';
import { ORDER_LIMITS } from '../config';
import type {
  MenuDto,
  MenuItemDto,
  OrderDto,
  OrderItemDto,
  RestaurantDto,
  Role,
} from '../types';
import {
  CollapsibleForm,
  ErrorBanner,
  SuccessBanner,
  formatPrice,
} from '../ui';

/**
 * Позиция в корзине.
 *
 * Ключ строим по id блюда, а не по id позиции заказа:
 * заказ может содержать несколько позиций одного блюда,
 * в корзине они должны выглядеть одной строкой.
 */
interface CartLine {
  key: string;
  name: string;
  price: number;
  quantity: number;
}

/** Состояние летящего элемента, который летит в корзину. */
interface FlyState {
  name: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

const FLY_DURATION_MS = 700;

const toCartLines = (items: OrderItemDto[]): CartLine[] => {
  const lines = new Map<string, CartLine>();

  for (const item of items) {
    const key = `menu:${item.menuItem.id}`;
    const existing = lines.get(key);

    if (existing) {
      existing.quantity += item.quantity;

      continue;
    }

    lines.set(key, {
      key,
      name: item.menuItem.name,
      price: Number(item.menuItem.price),
      quantity: item.quantity,
    });
  }

  return [...lines.values()];
};

const mergeLine = (
  lines: CartLine[],
  line: CartLine,
): CartLine[] => {
  const existing = lines.find((item) => item.key === line.key);

  if (!existing) {
    return [...lines, line];
  }

  return lines.map((item) =>
    item.key === line.key
      ? { ...item, quantity: item.quantity + line.quantity }
      : item,
  );
};

export default function DishesView({
  restaurant,
  menu,
  canManage,
  role,
  userId,
  isGuest,
  onBack,
}: {
  restaurant: RestaurantDto;
  menu: MenuDto;
  canManage: boolean;
  role: Role;
  userId: number;
  isGuest: boolean;
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

  // Корзина: состав заказа, который видно сразу после нажатия «В заказ».
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [fly, setFly] = useState<FlyState | null>(null);
  const [pulseKey, setPulseKey] = useState(0);

  const cartButtonRef = useRef<HTMLButtonElement>(null);
  const flyTimerRef = useRef<number | null>(null);

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

  /**
   * Загружает состав корзины.
   *
   * У гостя заказ принадлежит гостевой сессии, у пользователя —
   * его собственные активные позиции.
   */
  const loadCart = useCallback(async () => {
    try {
      if (isGuest) {
        const orders = await getGuestOrders();
        const draft = orders.find(
          (order) =>
            order.order.restaurant?.id === restaurant.id &&
            order.order.status === 'NEW',
        );

        setCartLines(draft ? toCartLines(draft.items) : []);

        return;
      }

      setCartLines(toCartLines(await apiList<OrderItemDto>('/order-items')));
    } catch {
      // Корзина вспомогательная: её сбой не должен ломать страницу блюд.
    }
  }, [isGuest, restaurant.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  useEffect(
    () => () => {
      if (flyTimerRef.current !== null) {
        window.clearTimeout(flyTimerRef.current);
      }
    },
    [],
  );

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
      'Блюдо деактивировано');

  /**
   * Запускает анимацию: карточка блюда летит к иконке корзины.
   */
  const startFly = (item: MenuItemDto, source: HTMLElement | null) => {
    const target = cartButtonRef.current;

    if (!target) {
      return;
    }

    const from = (source ?? target).getBoundingClientRect();
    const to = target.getBoundingClientRect();

    const x = from.left + from.width / 2;
    const y = from.top + from.height / 2;

    setFly({
      name: item.name,
      x,
      y,
      dx: to.left + to.width / 2 - x,
      dy: to.top + to.height / 2 - y,
    });

    if (flyTimerRef.current !== null) {
      window.clearTimeout(flyTimerRef.current);
    }

    flyTimerRef.current = window.setTimeout(() => {
      setFly(null);
      flyTimerRef.current = null;
    }, FLY_DURATION_MS);
  };

  /**
   * Корзина = заказ в статусе NEW в этом ресторане.
   * Создаётся при первом добавлении.
   *
   * Позиция появляется в корзине сразу, до ответа сервера:
   * так видно, что блюдо уходит в заказ, а не просто «обновляется страница».
   */
  const addToOrder = async (item: MenuItemDto, source: HTMLElement | null) => {
    const quantity = Math.min(
      ORDER_LIMITS.maxQuantityPerItem,
      Math.max(1, Math.floor(Number(qty[item.id] ?? '1')) || 1),
    );

    setAddingId(item.id);
    setError('');

    const snapshot = cartLines;

    setCartLines((lines) =>
      mergeLine(lines, {
        key: `menu:${item.id}`,
        name: item.name,
        price: Number(item.price),
        quantity,
      }),
    );

    startFly(item, source);
    setPulseKey((key) => key + 1);

    try {
      if (isGuest) {
        // У гостя заказ принадлежит гостевой сессии, а не пользователю.
        const draft = await getOrCreateGuestOrder(restaurant.id);

        const updated = await addGuestOrderItem(draft.order.id, item.id, quantity);

        setCartLines(toCartLines(updated.items));
      } else {
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

        // Состав заказа у пользователя берём с сервера: позиции могут
        // уже существовать, и их количество посчитает бэкенд.
        void loadCart();
      }

      setQty({
        ...qty,
        [item.id]: '1',
      });

      setSuccess(`«${item.name}» добавлено в заказ`);
    } catch (err) {
      setCartLines(snapshot);
      setError(
        err instanceof Error ? err.message : 'Не удалось добавить в заказ',
      );
    } finally {
      setAddingId(null);
    }
  };

  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cartLines.reduce(
    (sum, line) => sum + line.price * line.quantity,
    0,
  );

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
                      disabled={addingId !== null}
                      onClick={(event) =>
                        void addToOrder(
                          item,
                          event.currentTarget.closest('.dish-card'),
                        )
                      }
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

      {fly && (
        <div
          className="fly-to-cart"
          style={
            {
              '--fly-x': `${fly.x}px`,
              '--fly-y': `${fly.y}px`,
              '--fly-dx': `${fly.dx}px`,
              '--fly-dy': `${fly.dy}px`,
            } as CSSProperties
          }
        >
          <span className="fly-to-cart__name">{fly.name}</span>
        </div>
      )}

      <button
        ref={cartButtonRef}
        type="button"
        className="cart-button"
        onClick={() => setCartOpen((open) => !open)}
        aria-label="Ваш заказ"
      >
        <span className="cart-button__icon">🛒</span>

        {cartCount > 0 && (
          <span key={pulseKey} className="cart-badge">
            {cartCount}
          </span>
        )}
      </button>

      {cartOpen && (
        <div className="cart-panel">
          <div className="cart-panel__head">
            <span>Ваш заказ</span>

            <button
              type="button"
              className="cart-panel__close"
              onClick={() => setCartOpen(false)}
              aria-label="Закрыть корзину"
            >
              ✕
            </button>
          </div>

          {cartLines.length === 0 ? (
            <div className="cart-panel__empty">В заказе пока пусто</div>
          ) : (
            <ul className="cart-panel__list">
              {cartLines.map((line) => (
                <li key={line.key}>
                  <span className="cart-panel__name">{line.name}</span>
                  <span className="cart-panel__qty">× {line.quantity}</span>
                  <span className="cart-panel__price">
                    {formatPrice(line.price * line.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="cart-panel__total">
            Итого: {formatPrice(cartTotal)}
          </div>
        </div>
      )}
    </div>
  );
}
