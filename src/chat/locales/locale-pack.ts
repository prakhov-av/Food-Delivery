import { Status } from '../../orders/enums/status.enum';

export interface OrderLabels {
  order: string;
  status: string;
  total: string;
  restaurant: string;
  customer: string;
  courier: string;
  created: string;
  noCourier: string;
  guestCustomer: string;
  noStatus: string;
  emptyCart: string;
  itemsHeader: string;
  noItems: string;
  noOrdersCourier: string;
  noOrdersCustomer: string;
  noOrdersStaff: string;
  orderNotFound: string;
  noSuchOrderCourier: string;
  noSuchOrderCustomer: string;
  liveDataRequired: string;
  /** Строка про «ещё N заказов» в списке заказов. {count} — число скрытых заказов. */
  moreOrders: string;
}

export interface LocalePack {
  greetings: string[];
  capabilityQuestions: string[];

  capabilitiesAnswer: string;
  greetingAnswer: string;
  noKnowledgeAnswer: string;
  promptLeakAnswer: string;
  /**
   * Ответ, когда внешний сервис (LLM, эмбеддинги, векторная база) недоступен.
   *
   * Пользователь должен получить внятный ответ вместо 500: сбой провайдера
   * не должен выглядеть как поломка приложения.
   */
  unavailableAnswer: string;
  /** Ответ, когда идентичность исчерпала дневной лимит сообщений. */
  dailyLimitAnswer: string;

  orderListPatterns: RegExp[];
  orderNumberPattern: RegExp;
  orderMention: RegExp;
  liveOrderMarkers: RegExp[];
  notAboutOrderData: RegExp;
  singleOrderPossessive: RegExp;

  followUpPronouns: RegExp;
  followUpStart: RegExp;

  injectionPatterns: RegExp[];

  statusLabels: Record<Status, string>;
  orderLabels: OrderLabels;

  publicPhrases: string[];
  standaloneQuestionExample: string;
}
