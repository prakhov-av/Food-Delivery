import { Status } from '../../orders/enums/status.enum';
import { Lang } from './lang';
import { LocalePack } from './locale-pack';

/**
 * Russian pack: it carries the current behaviour of the chat.
 * The patterns are moved from chat.service.ts unchanged.
 */
const RU: LocalePack = {
  greetings: [
    'привет',
    'приветствую',
    'здравствуй',
    'здравствуйте',
    'добрый день',
    'добрый вечер',
    'доброе утро',
  ],

  capabilityQuestions: [
    'что ты умеешь',
    'что вы умеете',
    'что ты можешь',
    'что вы можете',
    'чем ты можешь помочь',
    'чем вы можете помочь',
    'чем можешь помочь',
    'о чем можно спросить',
    'о чём можно спросить',
    'что можно спросить',
    'помощь',
  ],

  capabilitiesAnswer:
    'Я могу помочь с правилами сервиса (рестораны, меню, заказы и статусы, доставка, регистрация и вход) и вашими текущими заказами.',

  greetingAnswer:
    'Здравствуйте! Я могу помочь с правилами сервиса (рестораны, меню, заказы и статусы, доставка, регистрация и вход) и вашими текущими заказами.',

  noKnowledgeAnswer:
    'В базе знаний нет информации по этому вопросу. Попробуйте переформулировать вопрос.',

  promptLeakAnswer:
    'Я не могу показывать внутренние инструкции. Могу помочь с заказами, ресторанами, меню, доставкой и регистрацией.',

  unavailableAnswer:
    'Помощник сейчас недоступен: не удалось получить ответ от сервиса. Попробуйте повторить вопрос чуть позже.',

  dailyLimitAnswer:
    'Дневной лимит обращений к помощнику исчерпан. Попробуйте снова завтра.',

  orderListPatterns: [
    /(?<![\p{L}])какие\s+(?:у\s+меня\s+)?заказы(?![\p{L}])/iu,
    /(?<![\p{L}])все\s+заказы(?![\p{L}])/iu,
    /(?<![\p{L}])мои\s+заказы(?![\p{L}])/iu,
    /(?<![\p{L}])моих\s+заказов(?![\p{L}])/iu,
    /(?<![\p{L}])заказы\s+(?:сейчас\s+)?в\s+работе(?![\p{L}])/iu,
    /(?<![\p{L}])заказы\s+мне\s+назначены(?![\p{L}])/iu,
  ],

  orderNumberPattern:
    /(?<![\p{L}\p{N}])заказ(?:а|е|у|ом)?\s*(?:№\s*)?(\d{1,9})(?![\p{L}\p{N}])/iu,

  liveOrderMarkers: [
    // «что в» без привязки к заказу ловит «что в меню» и уводит вопрос
    // в ветку живых данных. Маркер требует слово «заказ».
    /(?<![\p{L}])что\s+в[^?!.]*?заказ\p{L}*(?![\p{L}])/iu,
    /(?<![\p{L}])статус(?:а|е|у|ом)?(?![\p{L}])/iu,
    /(?<![\p{L}])когда\s+достав/iu,
  ],

  notAboutOrderData:
    /(?<![\p{L}])(?:как(?![\p{L}])|можно|нельзя|нужно|надо|должен|должна|должно|следует|выгодно|запрещ\p{L}*|почему|зачем|правил\p{L}*|что\s+делать|что\s+значит|что\s+означает|измен\p{L}*|отмен\p{L}*|оформ\p{L}*|созда\p{L}*|оплат\p{L}*|верн\p{L}*|жалоб\p{L}*|принять|принима\p{L}*)/iu,

  singleOrderPossessive:
    /(?<![\p{L}])мо(?:й|его|ю|я)\s+заказ(?![\p{L}])/iu,

  orderMention: /заказ\p{L}*/iu,

  followUpPronouns:
    /(?<![\p{L}])(?:его|её|ею|им|ими|нём|нему|него|неё|ней|из\s+них|у\s+них|у\s+него|у\s+неё)(?![\p{L}])/iu,

  followUpStart: /^\s*(?:а|и|итак|тоже|ну)(?![\p{L}])/iu,

  injectionPatterns: [
    /системн\p{L}*\s+(?:инструкци\p{L}*|промпт\p{L}*)/iu,
    /(?:покажи|выведи|напиши|повтори|процитируй|раскрой|выдай|пришли|скажи|распечатай|перечисли)\p{L}*\s+(?:мне\s+)?(?:все\s+)?(?:свои|свой|твои|твой|ваши|ваш|внутренние|скрытые)\s+(?:инструкци\p{L}*|промпт\p{L}*)/iu,
    /(?:игнорируй|проигнорируй|забудь|отмени)\p{L}*\s+(?:все\s+)?(?:предыдущ\p{L}*|прежн\p{L}*|прошл\p{L}*|свои|системн\p{L}*)\s+(?:инструкци\p{L}*|указани\p{L}*)/iu,
  ],

  statusLabels: {
    [Status.NEW]: 'новый заказ, ожидает подтверждения менеджера',
    [Status.ACCEPTED]: 'заказ принят менеджером, готовится к приготовлению',
    [Status.COOKING]: 'готовится',
    [Status.READY]: 'готов, ждёт курьера',
    [Status.DELIVERING]: 'доставляется курьером',
    [Status.COMPLETED]: 'завершён',
    [Status.CANCELLED_CUSTOMER]: 'отменён клиентом',
    [Status.CANCELLED_COURIER]: 'отменён курьером',
    [Status.CANCELLED_STAFF]:
      'отменён менеджером или администратором',
  },

  orderLabels: {
    order: 'Заказ №',
    status: 'Статус:',
    total: 'Сумма:',
    restaurant: 'Ресторан:',
    customer: 'Клиент:',
    courier: 'Курьер:',
    created: 'Создан:',
    noCourier: 'не назначен',
    guestCustomer: 'Гость',
    noStatus: 'не указан',
    emptyCart:
      'Это пустая корзина: блюд в заказе нет, такой заказ нельзя принять.',
    itemsHeader: 'Состав заказа:',
    noItems: 'Состав заказа: активных позиций нет.',
    noOrdersCourier: 'У вас нет заказов на выполнение.',
    noOrdersCustomer: 'У вас нет заказов.',
    noOrdersStaff: 'В системе нет доступных заказов.',
    orderNotFound: 'Заказ №{id} не найден.',
    noSuchOrderCourier: 'У вас нет заказа №{id} на выполнение.',
    noSuchOrderCustomer: 'У вас нет заказа №{id} среди ваших заказов.',
    liveDataRequired: 'Для ответа на этот вопрос необходимы актуальные данные системы.',
    moreOrders: 'и ещё {count}',
  },

  publicPhrases: [
    'правила сервиса (рестораны, меню, заказы и статусы, доставка, регистрация и вход) и его текущие заказы',
    'спросить о заказах, их статусах, ресторанах, меню, доставке или регистрации',
    'можешь помочь с заказами, ресторанами, меню, доставкой и регистрацией',
  ],

  standaloneQuestionExample:
    'Покажи все позиции меню ресторана Tokyo Roll с названиями, описаниями и ценами',
};



/** Английский пак. */
const EN: LocalePack = {
  greetings: [
    'hello',
    'hi',
    'hey',
    'hi there',
    'good morning',
    'good afternoon',
    'good evening',
    'greetings',
    'howdy',
  ],

  capabilityQuestions: [
    'what can you do',
    'what do you do',
    'what are you able to do',
    'what can you help with',
    'what can i ask you',
    'what can i ask',
    'what should i ask',
    'help',
    'help me',
    'capabilities',
  ],


  capabilitiesAnswer:
    'I can help with the service rules (restaurants, menus, orders and statuses, delivery, registration and login) and with your current orders.',

  greetingAnswer:
    'Hello! I can help with the service rules (restaurants, menus, orders and statuses, delivery, registration and login) and with your current orders.',

  noKnowledgeAnswer:
    'There is no information about this question in the knowledge base. Please rephrase your question.',

  promptLeakAnswer:
    'I cannot show internal instructions. I can help with orders, restaurants, menus, delivery and registration.',

  unavailableAnswer:
    'The assistant is temporarily unavailable: the service did not return an answer. Please try again a bit later.',

  dailyLimitAnswer:
    'The daily limit of assistant requests has been reached. Please try again tomorrow.',

  orderListPatterns: [
    /(?<![\p{L}])what\s+(?:are\s+|is\s+)?my\s+orders?(?![\p{L}])/iu,
    /(?<![\p{L}])my\s+orders?(?![\p{L}])/iu,
    /(?<![\p{L}])all\s+(?:my\s+)?orders?(?![\p{L}])/iu,
    /(?<![\p{L}])orders?\s+(?:currently\s+)?in\s+progress(?![\p{L}])/iu,
    /(?<![\p{L}])orders?\s+assigned\s+to\s+me(?![\p{L}])/iu,
    /(?<![\p{L}])list\s+(?:of\s+)?my\s+orders?(?![\p{L}])/iu,
  ],

  orderNumberPattern:
    /(?<![\p{L}\p{N}])orders?(?:\s*(?:no\.?|number|#|№))?\s*(\d{1,9})(?![\p{L}\p{N}])/iu,

  liveOrderMarkers: [
    /(?<![\p{L}])what(?:'s|\s+is|\s+are)\s+(?:in|inside|on)(?![\p{L}])/iu,
    /(?<![\p{L}])status(?:es)?(?![\p{L}])/iu,
    /(?<![\p{L}])when\s+(?:will\s+|do\s+|is\s+)?(?:it|the\s+order|delivery)\s+(?:be\s+)?(?:delivered|arrive|ready)/iu,
    /(?<![\p{L}])where\s+(?:is|are)\s+(?:my|the)\s+orders?(?![\p{L}])/iu,
  ],

  notAboutOrderData:
    /(?<![\p{L}])(?:how\s+(?:do|can|could|should|must|to)|can|cannot|can't|may|should|must|why|what\s+to\s+do|what\s+does|what\s+means|rules?|policy|allowed|forbidden|change|cancel|place|create|pay|refund|complain|return|need\s+to)(?![\p{L}])/iu,

  singleOrderPossessive:
    /(?<![\p{L}])my\s+(?:last\s+|current\s+|latest\s+)?orders?(?![\p{L}])/iu,

  orderMention: /\border(?:s|ed|ing)?\b/iu,

  followUpPronouns:
    /(?<![\p{L}])(?:it|its|them|they|him|her|that\s+one)(?![\p{L}])/iu,

  followUpStart: /^\s*(?:and|also|well|so|too|ok(?:ay)?)(?![\p{L}])/iu,

  injectionPatterns: [
    /(?:system|hidden|initial|internal)\s+(?:prompt|instructions?)/i,
    /(?:ignore|disregard|forget|override)\s+(?:all\s+|any\s+)?(?:the\s+|your\s+)?(?:previous|prior|above|earlier|system)\s+(?:instructions?|prompts?|rules)/i,
    // Объект обязателен: «show me the instructions for registration» — это
    // вопрос про документацию, а не попытка вытащить системный промпт.
    /(?:reveal|show|print|repeat|display|output)\s+(?:me\s+)?(?:all\s+)?(?:your\s+(?:system\s+|hidden\s+|internal\s+|initial\s+)?|(?:the\s+)?(?:system|hidden|internal|initial)\s+)(?:prompt|instructions?)/i,
  ],

  statusLabels: {
    [Status.NEW]: 'new order, waiting for manager confirmation',
    [Status.ACCEPTED]: 'order accepted by the manager, being prepared',
    [Status.COOKING]: 'being prepared',
    [Status.READY]: 'ready, waiting for the courier',
    [Status.DELIVERING]: 'on the way with the courier',
    [Status.COMPLETED]: 'completed',
    [Status.CANCELLED_CUSTOMER]: 'cancelled by the customer',
    [Status.CANCELLED_COURIER]: 'cancelled by the courier',
    [Status.CANCELLED_STAFF]: 'cancelled by the manager or administrator',
  },

  orderLabels: {
    order: 'Order №',
    status: 'Status:',
    total: 'Total:',
    restaurant: 'Restaurant:',
    customer: 'Customer:',
    courier: 'Courier:',
    created: 'Created:',
    noCourier: 'not assigned',
    guestCustomer: 'Guest',
    noStatus: 'not specified',
    emptyCart:
      'This is an empty cart: there are no items in the order, so it cannot be accepted.',
    itemsHeader: 'Order items:',
    noItems: 'Order items: no active positions.',
    noOrdersCourier: 'You have no orders to deliver.',
    noOrdersCustomer: 'You have no orders.',
    noOrdersStaff: 'There are no orders available in the system.',
    orderNotFound: 'Order №{id} not found.',
    noSuchOrderCourier: 'You have no order №{id} to deliver.',
    noSuchOrderCustomer: 'Order №{id} is not among your orders.',
    liveDataRequired:
      'This question requires up-to-date system data to be answered.',
    moreOrders: 'and {count} more',
  },

  publicPhrases: [
    'service rules (restaurants, menus, orders and statuses, delivery, registration and login) and their current orders',
    'ask about orders, their statuses, restaurants, menus, delivery or registration',
    'help with orders, restaurants, menus, delivery and registration',
  ],

  standaloneQuestionExample:
    'Show all menu items of the restaurant Tokyo Roll with names, descriptions and prices',
};

/** Немецкий пак. */
const DE: LocalePack = {
  greetings: [
    'hallo',
    'hallo zusammen',
    'guten tag',
    'guten morgen',
    'guten abend',
    'moin',
    'servus',
    'na hallo',
  ],

  capabilityQuestions: [
    'was kannst du',
    'was kannst du alles',
    'was kannst du mir helfen',
    'wie kannst du helfen',
    'kannst du helfen',
    'was kann ich fragen',
    'was kann ich dich fragen',
    'hilfe',
    'funktionen',
  ],

  capabilitiesAnswer:
    'Ich kann bei den Service-Regeln helfen (Restaurants, Menüs, Bestellungen und Status, Lieferung, Registrierung und Anmeldung) und mit Ihren aktuellen Bestellungen.',

  greetingAnswer:
    'Hallo! Ich kann bei den Service-Regeln helfen (Restaurants, Menüs, Bestellungen und Status, Lieferung, Registrierung und Anmeldung) und mit Ihren aktuellen Bestellungen.',

  noKnowledgeAnswer:
    'In der Wissensbasis gibt es keine Informationen zu dieser Frage. Bitte formulieren Sie die Frage anders.',

  promptLeakAnswer:
    'Ich kann keine internen Anweisungen zeigen. Ich helfe bei Bestellungen, Restaurants, Menüs, Lieferung und Registrierung.',

  unavailableAnswer:
    'Der Assistent ist vorübergehend nicht verfügbar: der Dienst hat keine Antwort geliefert. Bitte versuchen Sie es gleich noch einmal.',

  dailyLimitAnswer:
    'Das Tageslimit für Anfragen an den Assistenten ist erreicht. Bitte versuchen Sie es morgen erneut.',

  orderListPatterns: [
    /(?<![\p{L}])was\s+sind\s+meine\s+bestellungen(?![\p{L}])/iu,
    /(?<![\p{L}])meine\s+bestellungen(?![\p{L}])/iu,
    /(?<![\p{L}])alle\s+bestellungen(?![\p{L}])/iu,
    /(?<![\p{L}])bestellungen\s+in\s+arbeit(?![\p{L}])/iu,
    /(?<![\p{L}])mir\s+zugewiesene\s+bestellungen(?![\p{L}])/iu,
    /(?<![\p{L}])liste\s+meiner\s+bestellungen(?![\p{L}])/iu,
  ],

  orderNumberPattern:
    /(?<![\p{L}\p{N}])bestellung(?:en)?(?:\s*(?:nr\.?|nummer|#|№))?\s*(\d{1,9})(?![\p{L}\p{N}])/iu,

  liveOrderMarkers: [
    /(?<![\p{L}])was\s+(?:ist|sind)\s+(?:drin|in\s+ihr|in\s+ihnen)(?![\p{L}])/iu,
    /(?<![\p{L}])status(?![\p{L}])/iu,
    /(?<![\p{L}])wann\s+(?:wird\s+)?(?:geliefert|zugestellt|fertig)(?![\p{L}])/iu,
    /(?<![\p{L}])wo\s+(?:ist|sind)\s+meine\s+bestellung(?:en)?(?![\p{L}])/iu,
  ],

  notAboutOrderData:
    // bestellen/abbrechen/stornieren стоят только здесь: внутри «wie …» они
    // дублировали те же слова и ничего не добавляли к разбору.
    /(?<![\p{L}])(?:wie\s+(?:kann|könnte|muss|soll|geht)|kann\s+ich|dürf|darf|muss|müssen|soll|sollte|warum|weshalb|was\s+bedeutet|was\s+soll|regeln?|richtlinie|erlaubt|verboten|ändern|abbrechen|stornieren|bestellen|anlegen|bezahlen|erstatten|beschwerde|zurückgeben)(?![\p{L}])/iu,

  singleOrderPossessive:
    /(?<![\p{L}])meine(?:r|s)?\s+(?:letzte[nrs]?\s+|aktuelle[nrs]?\s+|nächste[nrs]?\s+)?bestellung(?:en)?(?![\p{L}])/iu,

  orderMention: /bestellung\p{L}*/iu,

  followUpPronouns:
    /(?<![\p{L}])(?:ihn|ihm|ihnen|ihre|es|davon|daran|darin)(?![\p{L}])/iu,

  followUpStart: /^\s*(?:und|auch|also|naja|okay|tja)(?![\p{L}])/iu,

  injectionPatterns: [
    /system(?:prompt|anweisung(?:en)?)/iu,
    // Объект обязателен: «Zeig mir die Regeln der Lieferung» — это вопрос
    // про правила доставки, а не попытка вытащить внутренние инструкции.
    /(?:zeige|zeig|nenne|drucke|wiederhole|verrate|gib)\p{L}*\s+(?:mir\s+)?(?:alle\s+)?(?:deine[nrs]?|(?:die\s+)?(?:internen?|versteckten?|geheimen?|system))\s*(?:anweisung(?:en)?|prompts?|regeln)/iu,
    // Объект тоже обязателен: «Vergiss vorherige» без объекта — обычная фраза.
    /(?:ignoriere|vergiss|missachte|überschreibe)\p{L}*\s+(?:alle\s+)?(?:vorherigen?|bisherigen?|obigen?|system)\p{L}*\s*(?:anweisung(?:en)?|prompts?|regeln)/iu,
  ],

  statusLabels: {
    [Status.NEW]: 'neue Bestellung, wartet auf die Bestätigung des Managers',
    [Status.ACCEPTED]: 'Bestellung vom Manager angenommen, wird zubereitet',
    [Status.COOKING]: 'wird zubereitet',
    [Status.READY]: 'fertig, wartet auf den Kurier',
    [Status.DELIVERING]: 'wird vom Kurier zugestellt',
    [Status.COMPLETED]: 'abgeschlossen',
    [Status.CANCELLED_CUSTOMER]: 'vom Kunden storniert',
    [Status.CANCELLED_COURIER]: 'vom Kurier storniert',
    [Status.CANCELLED_STAFF]: 'vom Manager oder Administrator storniert',
  },

  orderLabels: {
    order: 'Bestellung №',
    status: 'Status:',
    total: 'Gesamt:',
    restaurant: 'Restaurant:',
    customer: 'Kunde:',
    courier: 'Kurier:',
    created: 'Erstellt:',
    noCourier: 'nicht zugewiesen',
    guestCustomer: 'Gast',
    noStatus: 'nicht angegeben',
    emptyCart:
      'Dies ist ein leerer Warenkorb: die Bestellung enthält keine Artikel und kann nicht angenommen werden.',
    itemsHeader: 'Bestellpositionen:',
    noItems: 'Bestellpositionen: keine aktiven Positionen.',
    noOrdersCourier: 'Sie haben keine Bestellungen zum Zustellen.',
    noOrdersCustomer: 'Sie haben keine Bestellungen.',
    noOrdersStaff: 'Im System sind keine Bestellungen verfügbar.',
    orderNotFound: 'Bestellung №{id} nicht gefunden.',
    noSuchOrderCourier: 'Sie haben keine Bestellung №{id} zum Zustellen.',
    noSuchOrderCustomer:
      'Bestellung №{id} ist nicht unter Ihren Bestellungen.',
    liveDataRequired:
      'Für die Beantwortung dieser Frage sind aktuelle Systemdaten erforderlich.',
    moreOrders: 'und {count} weitere',
  },

  publicPhrases: [
    'Service-Regeln (Restaurants, Menüs, Bestellungen und Status, Lieferung, Registrierung und Anmeldung) und aktuelle Bestellungen',
    'nach Bestellungen, ihrem Status, Restaurants, Menüs, Lieferung oder Registrierung fragen',
    'bei Bestellungen, Restaurants, Menüs, Lieferung und Registrierung helfen',
  ],

  standaloneQuestionExample:
    'Zeige alle Menüpunkte des Restaurants Tokyo Roll mit Namen, Beschreibungen und Preisen',
};

/**
 * Registry of the packs. The Record<Lang, LocalePack> type makes it
 * impossible to forget a language: adding one to Lang without a pack breaks
 * the build.
 */
export const LOCALE_PACKS: Record<Lang, LocalePack> = {
  [Lang.RU]: RU,
  [Lang.EN]: EN,
  [Lang.DE]: DE,
};

/**
 * Injection patterns of all languages combined.
 *
 * An attacker writes in any language, no matter what the detector returned,
 * so the filter has to be common.
 */
export const ALL_INJECTION_PATTERNS: RegExp[] = Object.values(LOCALE_PACKS)
  .flatMap((pack: LocalePack): RegExp[] => pack.injectionPatterns);

/** Объединение списочных маркеров заказов по всем языкам. */
export const ALL_ORDER_LIST_PATTERNS: RegExp[] = Object.values(LOCALE_PACKS)
  .flatMap((pack: LocalePack): RegExp[] => pack.orderListPatterns);

/** Объединение маркеров «вопрос о правилах, а не о данных заказа». */
export const ALL_NOT_ABOUT_ORDER_DATA: RegExp[] = Object.values(LOCALE_PACKS)
  .flatMap((pack: LocalePack): RegExp[] => [pack.notAboutOrderData]);

/** Объединение маркеров уточняющей реплики. */
export const ALL_FOLLOW_UP_PRONOUNS: RegExp[] = Object.values(LOCALE_PACKS)
  .flatMap((pack: LocalePack): RegExp[] => [pack.followUpPronouns]);

/** Объединение начал уточняющей реплики. */
export const ALL_FOLLOW_UP_START: RegExp[] = Object.values(LOCALE_PACKS).flatMap(
  (pack: LocalePack): RegExp[] => [pack.followUpStart],
);

/** Объединение маркеров живых данных заказа. */
export const ALL_LIVE_ORDER_MARKERS: RegExp[] = Object.values(LOCALE_PACKS)
  .flatMap((pack: LocalePack): RegExp[] => pack.liveOrderMarkers);

/** Объединение притяжательных маркеров «мой заказ». */
export const ALL_SINGLE_ORDER_POSSESSIVE: RegExp[] = Object.values(
  LOCALE_PACKS,
).flatMap((pack: LocalePack): RegExp[] => [pack.singleOrderPossessive]);

/** Объединение шаблонов номера заказа. */
export const ALL_ORDER_NUMBER_PATTERNS: RegExp[] = Object.values(LOCALE_PACKS)
  .flatMap((pack: LocalePack): RegExp[] => [pack.orderNumberPattern]);

/** Объединение шаблонов упоминания заказа. */
export const ALL_ORDER_MENTIONS: RegExp[] = Object.values(LOCALE_PACKS)
  .flatMap((pack: LocalePack): RegExp[] => [pack.orderMention]);
