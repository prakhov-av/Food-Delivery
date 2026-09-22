import { BadRequestException } from '@nestjs/common';
import { Status } from '../enums/status.enum';
import { Role } from '../../users/enums/role.enum';

const allowedTransitions: Record<
    Role,
    Partial<Record<Status, Status[]>>
> = {
    [Role.CUSTOMER]: {
        [Status.NEW]: [
            Status.CREATED,
            Status.CANCELLED_CUSTOMER,
        ],

        [Status.CREATED]: [
            Status.CANCELLED_CUSTOMER,
        ],

        [Status.ACCEPTED]: [
            Status.CANCELLED_CUSTOMER,
        ],

        [Status.COOKING]: [
            Status.CANCELLED_CUSTOMER,
        ],
    },

    [Role.MANAGER]: {
        [Status.CREATED]: [
            Status.ACCEPTED,
        ],

        [Status.ACCEPTED]: [
            Status.COOKING,
        ],

        [Status.COOKING]: [
            Status.READY,
        ],
    },

    [Role.COURIER]: {
        [Status.READY]: [
            Status.DELIVERING,
            Status.CANCELLED_COURIER,
        ],

        [Status.DELIVERING]: [
            Status.COMPLETED,
            Status.CANCELLED_COURIER,
        ],
    },

    [Role.ADMIN]: {},
};

export function checkOrderStatusChange(
    currentStatus: Status,
    newStatus: Status,
    role: Role,
): void {

    if (role === Role.ADMIN) {
        return;
    }

    const allowed =
        allowedTransitions[role]?.[currentStatus] ?? [];

    if (!allowed.includes(newStatus)) {
        throw new BadRequestException(
            `Role ${role} cannot change order status from ${currentStatus} to ${newStatus}`,
        );
    }
}