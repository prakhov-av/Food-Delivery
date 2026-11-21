/**
 * Languages of the interface.
 *
 * The same set as on the backend: the language chosen in the interface is
 * sent to the chat with the request, so the two sets have to match.
 */
export type Lang = 'ru' | 'en' | 'de';

export const LANGS: Lang[] = ['ru', 'en', 'de'];

/** Default language. */
export const DEFAULT_LANG: Lang = 'ru';

/** Short labels for the switch buttons. */
export const LANG_SHORT: Record<Lang, string> = {
  ru: 'RU',
  en: 'EN',
  de: 'DE',
};

/** Full language names for the tooltips. */
export const LANG_LABELS: Record<Lang, string> = {
  ru: 'Русский',
  en: 'English',
  de: 'Deutsch',
};

/** Key in localStorage where the chosen language is stored. */
export const LANG_STORAGE_KEY = 'fd_lang';

/**
 * Dictionary: the key is the text to translate.
 *
 * The keys are flat, with a section prefix: 'chat.title', 'nav.restaurants'.
 * Parameters are substituted like this: t('order.total', { sum: '12' }).
 */
export type Dict = Record<string, string>;

/** Values that can be substituted into a string. */
export type Vars = Record<string, string | number>;
