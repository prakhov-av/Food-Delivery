import { api } from './api';
import type { GuestOrderDto, GuestSessionDto } from './types';

/**
 * Создаёт гостевую сессию.
 *
 * Backend выставляет HttpOnly cookie `guest-session` и возвращает срок её действия.
 * Сам токен во фронтенд не попадает и нигде не хранится.
 */
export async function createGuestSession(): Promise<GuestSessionDto> {
  return api<GuestSessionDto>('/guest-sessions', {
    method: 'POST',
    skipAuthRefresh: true,
  });
}

/**
 * Возвращает состояние текущей гостевой сессии.
 *
 * null означает, что гостевой сессии нет или срок её истёк.
 */
export async function getGuestSession(): Promise<GuestSessionDto | null> {
  try {
    return await api<GuestSessionDto>('/guest-sessions', {
      skipAuthRefresh: true,
    });
  } catch {
    return null;
  }
}

/**
 * Отзывает гостевую сессию и очищает cookie на стороне backend.
 */
export async function revokeGuestSession(): Promise<void> {
  try {
    await api('/guest-sessions/revoke', {
      method: 'POST',
      skipAuthRefresh: true,
    });
  } catch {
    // cookie всё равно чистится на сервере, ошибка не критична для выхода
  }
}

/** Заказы текущей гостевой сессии вместе с позициями. */
export async function getGuestOrders(): Promise<GuestOrderDto[]> {
  try {
    return await api<GuestOrderDto[]>('/guest-orders', {
      skipAuthRefresh: true,
    });
  } catch {
    return [];
  }
}

/** Добавляет позицию в заказ гостя. */
export async function addGuestOrderItem(
  orderId: number,
  menuItemId: number,
  quantity: number,
): Promise<GuestOrderDto> {
  return api<GuestOrderDto>(`/guest-orders/${orderId}/items`, {
    method: 'POST',
    body: JSON.stringify({ menuItemId, quantity }),
    skipAuthRefresh: true,
  });
}

/** Изменяет количество позиции в заказе гостя. */
export async function updateGuestOrderItem(
  orderId: number,
  itemId: number,
  newQuantity: number,
): Promise<GuestOrderDto> {
  return api<GuestOrderDto>(`/guest-orders/${orderId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ newQuantity }),
    skipAuthRefresh: true,
  });
}

/** Удаляет позицию из заказа гостя. */
export async function removeGuestOrderItem(
  orderId: number,
  itemId: number,
): Promise<GuestOrderDto> {
  return api<GuestOrderDto>(`/guest-orders/${orderId}/items/${itemId}`, {
    method: 'DELETE',
    skipAuthRefresh: true,
  });
}

/** Меняет статус заказа гостя. */
export async function setGuestOrderStatus(
  orderId: number,
  status: string,
): Promise<GuestOrderDto> {
  return api<GuestOrderDto>(`/guest-orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
    skipAuthRefresh: true,
  });
}

/** Возвращает или создаёт черновик заказа гостя в ресторане. */
export async function getOrCreateGuestOrder(
  restaurantId: number,
): Promise<GuestOrderDto> {
  return api<GuestOrderDto>('/guest-orders', {
    method: 'POST',
    body: JSON.stringify({ restaurantId }),
    skipAuthRefresh: true,
  });
}
