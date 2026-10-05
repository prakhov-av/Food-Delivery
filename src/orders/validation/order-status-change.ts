import { BadRequestException } from '@nestjs/common';

import { Status } from '../enums/status.enum';
import { Role } from '../../users/enums/role.enum';

const allowedTransitions: Record<Role, Partial<Record<Status, Status[]>>> = {
  [Role.CUSTOMER]: {
    [Status.NEW]: [Status.CANCELLED_CUSTOMER],
    [Status.ACCEPTED]: [Status.CANCELLED_CUSTOMER],
    [Status.COOKING]: [Status.CANCELLED_CUSTOMER],
  },

  [Role.MANAGER]: {
    [Status.NEW]: [Status.ACCEPTED, Status.CANCELLED_STAFF],
    [Status.ACCEPTED]: [Status.COOKING, Status.CANCELLED_STAFF],
    [Status.COOKING]: [Status.READY, Status.CANCELLED_STAFF],
    [Status.READY]: [Status.CANCELLED_STAFF],
  },

  [Role.COURIER]: {
    [Status.READY]: [Status.DELIVERING, Status.CANCELLED_COURIER],
    [Status.DELIVERING]: [Status.COMPLETED, Status.CANCELLED_COURIER],
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

  const allowed = allowedTransitions[role]?.[currentStatus] ?? [];

  if (!allowed.includes(newStatus)) {
    throw new BadRequestException(
      `Role ${role} cannot change order status from ${currentStatus} to ${newStatus}`,
    );
  }
}
