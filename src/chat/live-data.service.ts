import { ForbiddenException, Injectable } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { GuestOrdersService } from '../orders/guest-orders.service';
import { ChatIdentity } from './types/chat-identity';
import { Role } from '../users/enums/role.enum';
import { User } from '../users/user.entity';
import { OrderDto } from '../orders/dto/order.dto';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { ChatClassification } from './types/chat-classification';
import { LiveDataResource } from './enums/live-data-resource.enum';
import { DocumentType } from '../ingestion/enums/document-type.enum';
import { Status } from '../orders/enums/status.enum';
import { LiveDataResult } from './types/live-data-result';
import { DEFAULT_LANG, Lang } from './locales/lang';
import { LOCALE_PACKS } from './locales/locale-packs';
import { LocalePack } from './locales/locale-pack';

import {
  OrderItemLine,
  OrderWithItems,
} from '../orders/types/order-with-items';

/**
 * Сколько заказов показывать в списке.
 *
 * Больше десяти — это стена текста: в шаблоне пользователь её не читает,
 * а в ветке LLM она съедает контекст и дорого стоит.
 */
const MAX_ORDERS_IN_LIST = 10;

/** Локаль форматирования чисел и дат по языку ответа. */
const NUMBER_LOCALES: Record<Lang, string> = {
  [Lang.RU]: 'ru-RU',
  [Lang.EN]: 'en-GB',
  [Lang.DE]: 'de-DE',
};

/** Часовой пояс, в котором показываются даты заказов. */
const ORDER_TIME_ZONE = 'Europe/Berlin';

/**
 * Получает актуальные данные приложения для ответов чат-ассистента и ограничивает доступ к ресурсам с учётом пользователя и его роли.
 *
 * Подписи полей и статусов берутся из пака языка: модель их не переводит,
 * поэтому ответ детерминирован и не зависит от того, как модель поняла язык.
 */
@Injectable()
export class LiveDataService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly guestOrdersService?: GuestOrdersService,
  ) {}

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getLiveData(
    classification: ChatClassification,
    identityOrUserId: ChatIdentity | number,
    legacyUserRole?: Role,
    lang: Lang = DEFAULT_LANG,
  ): Promise<LiveDataResult> {
    const identity: ChatIdentity | null =
      typeof identityOrUserId === 'number'
        ? null
        : identityOrUserId;
    const userRole: Role = identity?.role ?? legacyUserRole ?? Role.CUSTOMER;
    const pack: LocalePack = LOCALE_PACKS[lang];

    if (
      classification.documentType !== DocumentType.ORDER ||
      classification.resource !== LiveDataResource.ORDER
    ) {
      return {
        context: pack.orderLabels.liveDataRequired,
      };
    }

    const user: Pick<User, 'id' | 'role'> | null =
      identity?.kind === 'guest'
        ? null
        : {
            id:
              identity?.kind === 'user'
                ? identity.userId
                : (identityOrUserId as number),
            role: userRole,
          };

    if (classification.resourceId === undefined) {
      try {
        const orders: OrderDto[] = identity?.kind === 'guest'
          ? await this.getGuestOrdersService().getCurrentGuestOrders(identity.guestSessionId)
          : await this.ordersService.getCurrentOrders(user!);

        // Пустые корзины скрыты на вкладке «Заказы», в чате их тоже не показываем.
        const visibleOrders: OrderDto[] = orders.filter(
          (order: OrderDto): boolean => !this.isEmptyCart(order),
        );

        if (visibleOrders.length === 0) {
          return { context: this.formatNoOrdersMessage(pack, userRole) };
        }

        return {
          context: this.formatOrdersData(pack, lang, visibleOrders),
          orderId: visibleOrders.length === 1 ? visibleOrders[0].id : undefined,
        };
      } catch (error) {
        if (error instanceof EntityNotFoundException) {
          return { context: this.formatNoOrdersMessage(pack, userRole) };
        }

        throw error;
      }
    }

    try {
      const details: OrderWithItems = identity?.kind === 'guest'
        ? await this.getGuestOrdersService().getGuestOrderWithItemsById(
            classification.resourceId,
            identity.guestSessionId,
          )
        : await this.ordersService.getOrderWithItemsByIdForUser(
            classification.resourceId,
            user!,
          );

      return {
        context: this.formatOrderData(pack, lang, details.order, details.items),
        orderId: details.order.id,
      };
    } catch (error) {
      if (
        error instanceof EntityNotFoundException ||
        error instanceof ForbiddenException
      ) {
        return {
          context: this.formatNoOrdersMessage(
            pack,
            userRole,
            classification.resourceId,
          ),
        };
      }

      throw error;
    }
  }

  private getGuestOrdersService(): GuestOrdersService {
    if (!this.guestOrdersService) {
      throw new Error('GuestOrdersService is not configured');
    }

    return this.guestOrdersService;
  }

  private formatOrdersData(
    pack: LocalePack,
    lang: Lang,
    orders: OrderDto[],
  ): string {
    const visible: OrderDto[] = orders.slice(0, MAX_ORDERS_IN_LIST);
    const hidden: number = orders.length - visible.length;

    const blocks: string[] = visible.map(
      (order: OrderDto): string => this.formatOrderData(pack, lang, order),
    );

    if (hidden > 0) {
      blocks.push(pack.orderLabels.moreOrders.replace('{count}', String(hidden)));
    }

    return blocks.join('\n\n');
  }

  private formatNoOrdersMessage(
    pack: LocalePack,
    userRole: Role,
    orderId?: number,
  ): string {
    const labels = pack.orderLabels;

    if (orderId !== undefined) {
      if (userRole === Role.COURIER) {
        return labels.noSuchOrderCourier.replace('{id}', String(orderId));
      }

      if (userRole === Role.CUSTOMER) {
        return labels.noSuchOrderCustomer.replace('{id}', String(orderId));
      }

      return labels.orderNotFound.replace('{id}', String(orderId));
    }

    if (userRole === Role.COURIER) {
      return labels.noOrdersCourier;
    }

    if (userRole === Role.CUSTOMER) {
      return labels.noOrdersCustomer;
    }

    return labels.noOrdersStaff;
  }

  private isEmptyCart(order: OrderDto): boolean {
    return order.status === Status.NEW && Number(order.totalPrice) === 0;
  }

  private formatOrderData(
    pack: LocalePack,
    lang: Lang,
    order: OrderDto,
    items?: OrderItemLine[],
  ): string {
    const emptyCart: boolean = this.isEmptyCart(order);
    const labels = pack.orderLabels;

    const statusDescription: string = order.status
      ? pack.statusLabels[order.status]
      : labels.noStatus;

    return [
      `${labels.order}${order.id}`,
      `${labels.status} ${statusDescription}`,
      `${labels.total} ${this.formatPrice(lang, order.totalPrice)}`,
      `${labels.restaurant} ${order.restaurant.name}`,
      `${labels.customer} ${order.customer?.name ?? labels.guestCustomer}`,
      `${labels.courier} ${order.courier?.name ?? labels.noCourier}`,
      `${labels.created} ${this.formatDate(lang, order.createdAt)}`,
      ...(emptyCart ? [labels.emptyCart] : []),
      ...(items !== undefined && !emptyCart ? this.formatItems(pack, items) : []),
    ].join('\n');
  }

  /**
   * Сумма заказа в валюте и формате языка ответа.
   *
   * Раньше число подставлялось как есть: немецкий пользователь видел
   * «12.5 €» вместо «12,50 €».
   */
  private formatPrice(lang: Lang, totalPrice: number): string {
    try {
      return new Intl.NumberFormat(NUMBER_LOCALES[lang], {
        style: 'currency',
        currency: 'EUR',
      }).format(Number(totalPrice));
    } catch {
      return `${Number(totalPrice)} €`;
    }
  }

  /**
   * Дата создания заказа в читаемом виде.
   *
   * Раньше уходил ISO-строка в UTC: «2026-11-21T16:31:33.102Z» —
   * это не ответ пользователю, а дамп базы.
   */
  private formatDate(lang: Lang, createdAt: Date): string {
    const date: Date =
      createdAt instanceof Date ? createdAt : new Date(createdAt);

    if (Number.isNaN(date.getTime())) {
      return String(createdAt);
    }

    try {
      return new Intl.DateTimeFormat(NUMBER_LOCALES[lang], {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: ORDER_TIME_ZONE,
      }).format(date);
    } catch {
      return date.toISOString();
    }
  }

  private formatItems(pack: LocalePack, items: OrderItemLine[]): string[] {
    if (items.length === 0) {
      return [pack.orderLabels.noItems];
    }

    return [
      pack.orderLabels.itemsHeader,
      ...items.map(
        (item: OrderItemLine): string => `- ${item.name} × ${item.quantity}`,
      ),
    ];
  }
}
