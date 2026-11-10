import { BadRequestException } from '@nestjs/common';

import { Status } from '../enums/status.enum';

/**
 * Статусы, которые гость может выбрать самостоятельно.
 *
 * Гость не отменяет заказ: отменённые статусы в цепочку не входят,
 * потому что у ассистента нет актуальных данных об отмене.
 */
export const GUEST_STATUS_CHAIN: Status[] = [
  Status.NEW,
  Status.ACCEPTED,
  Status.COOKING,
  Status.READY,
  Status.DELIVERING,
  Status.COMPLETED,
];

/**
 * Возвращает статусы, доступные гостю для следующего шага.
 *
 * Движение возможно только вперёд по цепочке.
 */
export function getGuestNextStatuses(current: Status): Status[] {
  const index: number = GUEST_STATUS_CHAIN.indexOf(current);

  if (index === -1) {
    return [];
  }

  return GUEST_STATUS_CHAIN.slice(index + 1);
}

/**
 * Проверяет, что гость меняет статус на следующий по цепочке.
 */
export function checkGuestStatusChange(current: Status, next: Status): void {
  const allowed: Status[] = getGuestNextStatuses(current);

  if (!allowed.includes(next)) {
    throw new BadRequestException(
      `Guest cannot change order status from ${current} to ${next}`,
    );
  }
}
