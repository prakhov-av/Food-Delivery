export const MAX_QUANTITY_PER_ITEM = 20;
export const MAX_ITEMS_PER_ORDER = 20;
export const MAX_ORDER_TOTAL = 500;
export const MAX_SUBMITTED_ORDERS_PER_CUSTOMER = 5;

// Потолок активных заказов одной гостевой сессии.
// Гость не зарегистрирован, поэтому ограничение по числу клиентов к нему не применяется.
export const MAX_ACTIVE_GUEST_ORDERS = 5;
