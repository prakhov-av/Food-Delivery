import { BadRequestException } from '@nestjs/common';
import { Order } from '../order.entity';
import { CLOSED_STATUSES, Status } from '../enums/status.enum';
import { User } from '../../users/user.entity';
import { Role } from '../../users/enums/role.enum';

export function checkOrderModificationAllowed(
  order: Order,
  user: Pick<User, 'role'>,
): void {
  if (CLOSED_STATUSES.includes(order.status)) {
    throw new BadRequestException(
      `Order id ${order.id} cannot be modified when status is ${order.status}`,
    );
  }


  if (user.role === Role.CUSTOMER && order.status !== Status.NEW) {
    throw new BadRequestException(
      `Order id ${order.id} can be modified by a customer only while status is ${Status.NEW}`,
    );
  }
}
