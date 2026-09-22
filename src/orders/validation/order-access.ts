import { ForbiddenException } from '@nestjs/common';
import { Order } from '../order.entity';
import { User } from '../../users/user.entity';
import { Role } from '../../users/enums/role.enum';

export function checkOrderAccess(
    order: Order,
    user: User,
): void {
    if (user.role === Role.ADMIN) {
        return;
    }

    if (
        user.role === Role.CUSTOMER &&
        order.customer.id !== user.id
    ) {
        throw new ForbiddenException(
            'Customer can only access own orders',
        );
    }

    if (
        user.role === Role.COURIER &&
        (!order.courier || order.courier.id !== user.id)
    ) {
        throw new ForbiddenException(
            'Courier can only access assigned orders',
        );
    }


}