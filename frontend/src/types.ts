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

export const AUDIT_ACTIONS = [
  'AUTH_LOGIN',
  'USER_REGISTERED',
  'USER_CONFIRMED',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DELETED',
  'USER_RESTORED',
  'USER_ROLE_CHANGED',
  'CATALOG_CREATED',
  'CATALOG_UPDATED',
  'CATALOG_DELETED',
  'CATALOG_RESTORED',
  'ORDER_CREATED',
  'ORDER_STATUS_CHANGED',
  'ORDER_COURIER_ASSIGNED',
  'ORDER_ITEM_CHANGED',
  'KNOWLEDGE_UPLOADED',
  'CHAT_QUERY',
  'ACCESS_DENIED',
  'RATE_LIMITED',
] as const;

export interface AuditLogDto {
  id: number;
  createdAt: string;
  actorId: number | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: number | null;
  result: string;
  ip: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
}

export interface AuditPageDto {
  items: AuditLogDto[];
  total: number;
  page: number;
  pageSize: number;
}
