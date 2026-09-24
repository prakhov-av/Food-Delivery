import { BadRequestException } from '@nestjs/common';
import { Order } from '../order.entity';
import { Status } from '../enums/status.enum';

const CLOSED_STATUSES: Status[] = [
  Status.COMPLETED,
  Status.CANCELLED_CUSTOMER,
  Status.CANCELLED_COURIER,
];

export function checkOrderModificationAllowed(order: Order): void {
  if (CLOSED_STATUSES.includes(order.status)) {
    throw new BadRequestException(
      `Order id ${order.id} cannot be modified when status is ${order.status}`,
    );
  }
}
