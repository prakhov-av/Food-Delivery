export type Role = 'ADMIN' | 'MANAGER' | 'CUSTOMER' | 'COURIER';

export type OrderStatus =
  | 'NEW'
  | 'CREATED'
  | 'ACCEPTED'
  | 'COOKING'
  | 'READY'
  | 'DELIVERING'
  | 'COMPLETED'
  | 'CANCELLED';

export const ORDER_STATUSES: OrderStatus[] = [
  'NEW',
  'CREATED',
  'ACCEPTED',
  'COOKING',
  'READY',
  'DELIVERING',
  'COMPLETED',
  'CANCELLED',
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
  menuItem: MenuItemDto;
  quantity: number;
}
