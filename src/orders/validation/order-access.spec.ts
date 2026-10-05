import { ForbiddenException } from '@nestjs/common';
import { Order } from '../order.entity';
import { Role } from '../../users/enums/role.enum';
import { User } from '../../users/user.entity';
import { checkOrderAccess } from './order-access';

const createOrder = (customerId: number, courierId: number | null): Order =>
  ({
    id: 1,
    customer: { id: customerId } as User,
    courier: courierId === null ? null : ({ id: courierId } as User),
  }) as Order;

describe('checkOrderAccess', (): void => {
  const order: Order = createOrder(10, 20);

  it.each([Role.ADMIN, Role.MANAGER])(
    'should allow %s to access any order',
    (role: Role): void => {
      expect(() =>
        checkOrderAccess(order, { id: 999, role }),
      ).not.toThrow();
    },
  );

  it('should allow customer to access own order', (): void => {
    expect(() =>
      checkOrderAccess(order, { id: 10, role: Role.CUSTOMER }),
    ).not.toThrow();
  });

  it('should reject customer accessing another customer order', (): void => {
    expect(() =>
      checkOrderAccess(order, { id: 11, role: Role.CUSTOMER }),
    ).toThrow(new ForbiddenException('Customer can only access own orders'));
  });

  it('should allow courier to access an order assigned to them', (): void => {
    expect(() =>
      checkOrderAccess(order, { id: 20, role: Role.COURIER }),
    ).not.toThrow();
  });

  it('should reject courier accessing another courier order', (): void => {
    expect(() =>
      checkOrderAccess(order, { id: 21, role: Role.COURIER }),
    ).toThrow(new ForbiddenException('Courier can only access assigned orders'));
  });

  it('should reject courier accessing an unassigned order', (): void => {
    const unassignedOrder: Order = createOrder(10, null);

    expect(() =>
      checkOrderAccess(unassignedOrder, { id: 20, role: Role.COURIER }),
    ).toThrow(new ForbiddenException('Courier can only access assigned orders'));
  });
});
