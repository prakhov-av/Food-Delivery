import { BadRequestException } from '@nestjs/common';
import { checkOrderModificationAllowed } from './order-modification';
import { Order } from '../order.entity';
import { Status } from '../enums/status.enum';

describe('checkOrderModificationAllowed', () => {
  const createOrder = (status: Status, id = 1): Order => {
    const order = new Order();
    order.id = id;
    order.status = status;
    return order;
  };

  it('should allow modification of NEW order', () => {
    const order = createOrder(Status.NEW);

    expect(() => checkOrderModificationAllowed(order)).not.toThrow();
  });

  it('should throw BadRequestException for COMPLETED order', () => {
    const order = createOrder(Status.COMPLETED, 10);

    expect(() => checkOrderModificationAllowed(order)).toThrow(
      new BadRequestException(
        `Order id 10 cannot be modified when status is ${Status.COMPLETED}`,
      ),
    );
  });

  it('should throw BadRequestException for CANCELLED_CUSTOMER order', () => {
    const order = createOrder(Status.CANCELLED_CUSTOMER, 20);

    expect(() => checkOrderModificationAllowed(order)).toThrow(
      new BadRequestException(
        `Order id 20 cannot be modified when status is ${Status.CANCELLED_CUSTOMER}`,
      ),
    );
  });

  it('should throw BadRequestException for CANCELLED_COURIER order', () => {
    const order = createOrder(Status.CANCELLED_COURIER, 30);

    expect(() => checkOrderModificationAllowed(order)).toThrow(
      new BadRequestException(
        `Order id 30 cannot be modified when status is ${Status.CANCELLED_COURIER}`,
      ),
    );
  });
});
