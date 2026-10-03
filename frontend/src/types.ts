export type Role = 'ADMIN' | 'MANAGER' | 'CUSTOMER' | 'COURIER';

export type OrderStatus =
  | 'NEW'
  | 'CREATED'
  | 'ACCEPTED'
  | 'COOKING'
  | 'READY'
  | 'DELIVERING'
  | 'COMPLETED'
  | 'CANCELLED_CUSTOMER'
  | 'CANCELLED_COURIER';

export const ORDER_STATUSES: OrderStatus[] = [
  'NEW',
  'CREATED',
  'ACCEPTED',
  'COOKING',
  'READY',
  'DELIVERING',
  'COMPLETED',
  'CANCELLED_CUSTOMER',
  'CANCELLED_COURIER',
];

const CLOSED_STATUSES: OrderStatus[] = [
  'COMPLETED',
  'CANCELLED_CUSTOMER',
  'CANCELLED_COURIER',
];

export interface UserDto {
  id: number;
  name: string;
  role: Role;
  phone: string;
}

export interface RestaurantDto {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface MenuDto {
  id: number;
  name: string;
}

export interface MenuItemDto {
  id: number;
  name: string;
  description: string;
  price: number | string;
}

export interface OrderDto {
  id: number;
  customer: UserDto;
  courier: UserDto | null;
  restaurant: RestaurantDto;
  status?: OrderStatus;
  totalPrice: number | string;
  createdAt: string;
}

export interface OrderItemDto {
  id: number;
  orderId: number;
  menuItem: MenuItemDto;
  quantity: number;
}



export const CATALOG_MANAGERS: Role[] = ['ADMIN', 'MANAGER'];

export const canManageCatalog = (role: Role): boolean =>
  CATALOG_MANAGERS.includes(role);

export const canCreateOrder = (role: Role): boolean => role === 'CUSTOMER';

export const canAssignCourier = (role: Role): boolean =>
  role === 'ADMIN' || role === 'MANAGER';


export function canEditItems(role: Role, status?: OrderStatus): boolean {
  if (!status || CLOSED_STATUSES.includes(status)) return false;
  if (role === 'CUSTOMER') return status === 'NEW';
  return role === 'ADMIN' || role === 'MANAGER';
}

const TRANSITIONS: Record<Role, Partial<Record<OrderStatus, OrderStatus[]>>> = {
  CUSTOMER: {
    NEW: ['CREATED', 'CANCELLED_CUSTOMER'],
    CREATED: ['CANCELLED_CUSTOMER'],
    ACCEPTED: ['CANCELLED_CUSTOMER'],
    COOKING: ['CANCELLED_CUSTOMER'],
  },
  MANAGER: {
    CREATED: ['ACCEPTED'],
    ACCEPTED: ['COOKING'],
    COOKING: ['READY'],
  },
  COURIER: {
    READY: ['DELIVERING', 'CANCELLED_COURIER'],
    DELIVERING: ['COMPLETED', 'CANCELLED_COURIER'],
  },
  ADMIN: {},
};

export function nextStatuses(role: Role, current?: OrderStatus): OrderStatus[] {
  if (!current) return [];
  if (role === 'ADMIN') return ORDER_STATUSES.filter((s) => s !== current);
  return TRANSITIONS[role][current] ?? [];
}
