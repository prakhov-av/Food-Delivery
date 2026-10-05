import { BadRequestException } from '@nestjs/common';
import { checkOrderModificationAllowed } from './order-modification';
import { Order } from '../order.entity';
import { Status } from '../enums/status.enum';
import { Role } from '../../users/enums/role.enum';

describe('checkOrderModificationAllowed', () => {
  const createOrder = (status: Status, id = 1): Order => {
    const order = new Order();
    order.id = id;
    order.status = status;
    return order;
  };

  const createUser = (role: Role) => ({
    role,
  });

  it('should allow modification of NEW order', () => {
    const order = createOrder(Status.NEW);
    const user = createUser(Role.CUSTOMER);

    expect(() => checkOrderModificationAllowed(order, user)).not.toThrow();
  });

  it('should throw BadRequestException for COMPLETED order', () => {
    const order = createOrder(Status.COMPLETED, 10);
    const user = createUser(Role.ADMIN);

    expect(() => checkOrderModificationAllowed(order, user)).toThrow(
      new BadRequestException(
        `Order id 10 cannot be modified when status is ${Status.COMPLETED}`,
      ),
    );
  });

  it('should throw BadRequestException for CANCELLED_CUSTOMER order', () => {
    const order = createOrder(Status.CANCELLED_CUSTOMER, 20);
    const user = createUser(Role.ADMIN);

    expect(() => checkOrderModificationAllowed(order, user)).toThrow(
      new BadRequestException(
        `Order id 20 cannot be modified when status is ${Status.CANCELLED_CUSTOMER}`,
      ),
    );
  });

  it('should throw BadRequestException for CANCELLED_COURIER order', () => {
    const order = createOrder(Status.CANCELLED_COURIER, 30);
    const user = createUser(Role.ADMIN);

    expect(() => checkOrderModificationAllowed(order, user)).toThrow(
      new BadRequestException(
        `Order id 30 cannot be modified when status is ${Status.CANCELLED_COURIER}`,
      ),
    );
  });
});
