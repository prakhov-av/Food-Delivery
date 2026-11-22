import type { Role } from '../types';
import type { Dict, Lang } from './types';

/**
 * Interface dictionaries: the shared elements (navigation, chat, statuses,
 * errors).
 *
 * The keys are the same in all three dictionaries, so a forgotten
 * translation is noticed at once when the language is switched.
 */
export const CORE_RU: Dict = {
  'app.loading': 'Загрузка…',
  'app.title': 'FoodDelivery',

  'nav.restaurants': 'Рестораны',
  'nav.orders': 'Заказы',
  'nav.users': 'Пользователи',
  'nav.audit': 'Журнал',
  'nav.upload': 'Загрузка документа',
  'nav.myOrders': 'Мои заказы',

  'role.admin': 'Админ',
  'role.manager': 'Менеджер',
  'role.customer': 'Клиент',
  'role.courier': 'Курьер',

  'session.guest': 'Гость',
  'session.guestMode': 'Гостевой режим',

  'action.logout': 'Выйти',

  'chat.title': 'AI помощник',
  'chat.clear': 'Очистить',
  'chat.clearAria': 'Очистить историю переписки',
  'chat.closeAria': 'Закрыть чат',
  'chat.openAria': 'Открыть AI ассистента',
  'chat.closeAriaButton': 'Закрыть AI ассистента',
  'chat.labelOpen': 'Chat with AI',
  'chat.labelClose': 'Закрыть',
  'chat.greeting':
    'Здравствуйте! Выберите вопрос ниже или напишите свой.',
  'chat.liveNote':
    'Ответ с данными заказов не сохраняется. Задайте вопрос ещё раз, чтобы получить актуальные данные.',
  'chat.thinking': 'Думаю…',
  'chat.placeholder': 'Ваш вопрос…',
  'chat.errorUnavailable': 'Помощник временно недоступен, попробуйте позже',
  'chat.errorRateLimit':
    'Слишком много запросов. Подождите минуту и попробуйте снова.',
  'chat.errorGeneric': 'Не удалось получить ответ',
  'chat.errorClearFailed': 'Не удалось очистить историю',
  'chat.clearConfirm': 'Удалить всю историю переписки с помощником?',

  'ui.close': 'Закрыть',
  'ui.create': 'Создать',
  'ui.status.none': '—',
  'ui.status.new': 'Новый',
  'ui.status.accepted': 'Принят',
  'ui.status.cooking': 'Готовится',
  'ui.status.ready': 'Готов',
  'ui.status.delivering': 'Доставляется',
  'ui.status.completed': 'Завершён',
  'ui.status.cancelledCustomer': 'Отменён клиентом',
  'ui.status.cancelledCourier': 'Отменён курьером',
  'ui.status.cancelledStaff': 'Отменён персоналом',
  'ui.role.admin': 'Администратор',
  'ui.role.manager': 'Менеджер',
  'ui.role.customer': 'Клиент',
  'ui.role.courier': 'Курьер',

  'error.server': 'Сервер временно недоступен. Попробуйте позже.',
  'error.sessionExpired': 'Сессия истекла, войдите заново',
  'error.rateLimit':
    'Слишком много запросов. Подождите минуту и попробуйте снова.',

  'i18n.label': 'Язык',
};

export const CORE_EN: Dict = {
  'app.loading': 'Loading…',
  'app.title': 'FoodDelivery',

  'nav.restaurants': 'Restaurants',
  'nav.orders': 'Orders',
  'nav.users': 'Users',
  'nav.audit': 'Audit log',
  'nav.upload': 'Upload document',
  'nav.myOrders': 'My orders',

  'role.admin': 'Admin',
  'role.manager': 'Manager',
  'role.customer': 'Customer',
  'role.courier': 'Courier',

  'session.guest': 'Guest',
  'session.guestMode': 'Guest mode',

  'action.logout': 'Log out',

  'chat.title': 'AI assistant',
  'chat.clear': 'Clear',
  'chat.clearAria': 'Clear the conversation history',
  'chat.closeAria': 'Close chat',
  'chat.openAria': 'Open AI assistant',
  'chat.closeAriaButton': 'Close AI assistant',
  'chat.labelOpen': 'Chat with AI',
  'chat.labelClose': 'Close',
  'chat.greeting': 'Hello! Pick a question below or write your own.',
  'chat.liveNote':
    'Answers with order data are not stored. Ask the question again to get up-to-date data.',
  'chat.thinking': 'Thinking…',
  'chat.placeholder': 'Your question…',
  'chat.errorUnavailable': 'The assistant is temporarily unavailable, try later',
  'chat.errorRateLimit':
    'Too many requests. Please wait a minute and try again.',
  'chat.errorGeneric': 'Could not get an answer',
  'chat.errorClearFailed': 'Could not clear the history',
  'chat.clearConfirm': 'Delete the whole conversation with the assistant?',

  'ui.close': 'Close',
  'ui.create': 'Create',
  'ui.status.none': '—',
  'ui.status.new': 'New',
  'ui.status.accepted': 'Accepted',
  'ui.status.cooking': 'Cooking',
  'ui.status.ready': 'Ready',
  'ui.status.delivering': 'Delivering',
  'ui.status.completed': 'Completed',
  'ui.status.cancelledCustomer': 'Cancelled by customer',
  'ui.status.cancelledCourier': 'Cancelled by courier',
  'ui.status.cancelledStaff': 'Cancelled by staff',
  'ui.role.admin': 'Administrator',
  'ui.role.manager': 'Manager',
  'ui.role.customer': 'Customer',
  'ui.role.courier': 'Courier',

  'error.server': 'The server is temporarily unavailable. Please try later.',
  'error.sessionExpired': 'Your session has expired, please sign in again',
  'error.rateLimit':
    'Too many requests. Please wait a minute and try again.',

  'i18n.label': 'Language',
};

export const CORE_DE: Dict = {
  'app.loading': 'Wird geladen…',
  'app.title': 'FoodDelivery',

  'nav.restaurants': 'Restaurants',
  'nav.orders': 'Bestellungen',
  'nav.users': 'Benutzer',
  'nav.audit': 'Protokoll',
  'nav.upload': 'Dokument hochladen',
  'nav.myOrders': 'Meine Bestellungen',

  'role.admin': 'Admin',
  'role.manager': 'Manager',
  'role.customer': 'Kunde',
  'role.courier': 'Kurier',

  'session.guest': 'Gast',
  'session.guestMode': 'Gastmodus',

  'action.logout': 'Abmelden',

  'chat.title': 'KI-Assistent',
  'chat.clear': 'Leeren',
  'chat.clearAria': 'Chatverlauf löschen',
  'chat.closeAria': 'Chat schließen',
  'chat.openAria': 'KI-Assistent öffnen',
  'chat.closeAriaButton': 'KI-Assistent schließen',
  'chat.labelOpen': 'Chat mit KI',
  'chat.labelClose': 'Schließen',
  'chat.greeting':
    'Guten Tag! Wählen Sie unten eine Frage oder schreiben Sie Ihre eigene.',
  'chat.liveNote':
    'Antworten mit Bestelldaten werden nicht gespeichert. Stellen Sie die Frage erneut, um aktuelle Daten zu erhalten.',
  'chat.thinking': 'Denkt nach…',
  'chat.placeholder': 'Ihre Frage…',
  'chat.errorUnavailable':
    'Der Assistent ist vorübergehend nicht erreichbar, versuchen Sie es später',
  'chat.errorRateLimit':
    'Zu viele Anfragen. Bitte warten Sie eine Minute und versuchen Sie es erneut.',
  'chat.errorGeneric': 'Keine Antwort erhalten',
  'chat.errorClearFailed': 'Der Verlauf konnte nicht gelöscht werden',
  'chat.clearConfirm':
    'Den gesamten Chatverlauf mit dem Assistenten löschen?',

  'ui.close': 'Schließen',
  'ui.create': 'Erstellen',
  'ui.status.none': '—',
  'ui.status.new': 'Neu',
  'ui.status.accepted': 'Angenommen',
  'ui.status.cooking': 'In Zubereitung',
  'ui.status.ready': 'Bereit',
  'ui.status.delivering': 'Wird geliefert',
  'ui.status.completed': 'Abgeschlossen',
  'ui.status.cancelledCustomer': 'Vom Kunden storniert',
  'ui.status.cancelledCourier': 'Vom Kurier storniert',
  'ui.status.cancelledStaff': 'Vom Personal storniert',
  'ui.role.admin': 'Administrator',
  'ui.role.manager': 'Manager',
  'ui.role.customer': 'Kunde',
  'ui.role.courier': 'Kurier',

  'error.server':
    'Der Server ist vorübergehend nicht erreichbar. Bitte versuchen Sie es später.',
  'error.sessionExpired':
    'Ihre Sitzung ist abgelaufen, bitte melden Sie sich erneut an',
  'error.rateLimit':
    'Zu viele Anfragen. Bitte warten Sie eine Minute und versuchen Sie es erneut.',

  'i18n.label': 'Sprache',
};

/**
 * Quick questions in the chat: their own set for every role and language.
 *
 * The questions are picked so that they hit the fast paths without a model
 * call: a greeting and a question about the capabilities are answered with
 * a template.
 */
export const QUICK_QUESTIONS: Record<Lang, Record<Role, string[]>> = {
  ru: {
    CUSTOMER: [
      'Где мой заказ?',
      'Какие у меня заказы?',
      'Как оформить заказ?',
      'Как отменить заказ?',
      'Что ты умеешь?',
    ],
    COURIER: [
      'Какие заказы мне назначены?',
      'Как доставить заказ?',
      'Что ты умеешь?',
    ],
    MANAGER: [
      'Какие заказы сейчас в работе?',
      'Покажи все заказы',
      'Что ты умеешь?',
    ],
    ADMIN: [
      'Какие заказы сейчас в работе?',
      'Покажи все заказы',
      'Что ты умеешь?',
    ],
  },
  en: {
    CUSTOMER: [
      'Where is my order?',
      'What are my orders?',
      'How do I place an order?',
      'How do I cancel an order?',
      'What can you do?',
    ],
    COURIER: [
      'Which orders are assigned to me?',
      'How do I deliver an order?',
      'What can you do?',
    ],
    MANAGER: [
      'Which orders are in progress now?',
      'Show all orders',
      'What can you do?',
    ],
    ADMIN: [
      'Which orders are in progress now?',
      'Show all orders',
      'What can you do?',
    ],
  },
  de: {
    CUSTOMER: [
      'Wo ist meine Bestellung?',
      'Welche Bestellungen habe ich?',
      'Wie bestelle ich?',
      'Wie kann ich eine Bestellung stornieren?',
      'Was kannst du?',
    ],
    COURIER: [
      'Welche Bestellungen sind mir zugewiesen?',
      'Wie liefere ich eine Bestellung?',
      'Was kannst du?',
    ],
    MANAGER: [
      'Welche Bestellungen laufen gerade?',
      'Zeige alle Bestellungen',
      'Was kannst du?',
    ],
    ADMIN: [
      'Welche Bestellungen laufen gerade?',
      'Zeige alle Bestellungen',
      'Was kannst du?',
    ],
  },
};
