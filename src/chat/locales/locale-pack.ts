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
}

export interface LocalePack {
  greetings: string[];
  capabilityQuestions: string[];

  capabilitiesAnswer: string;
  greetingAnswer: string;
  noKnowledgeAnswer: string;
  promptLeakAnswer: string;

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
