/**
 * Languages supported by the chat assistant.
 *
 * The language is determined once, at the entry point of a request, and then
 * travels with it all the way to the answer. No individual function detects
 * the language on its own.
 */
export enum Lang {
  RU = 'ru',
  EN = 'en',
  DE = 'de',
}

export const ALL_LANGS: Lang[] = [Lang.RU, Lang.EN, Lang.DE];

/**
 * Default language.
 *
 * Used when the language cannot be determined: a short message without any
 * clue, the first message of a session, a request without a language.
 *
 * The choice is deliberate: the interface of the application starts in
 * English, but the backend answers API clients without a language in
 * Russian, because the knowledge base of the service is written in Russian
 * first. The browser always sends its language explicitly, so this default
 * only affects direct API calls.
 */
export const DEFAULT_LANG: Lang = Lang.RU;

/** Type safe check: the string is a supported language. */
const isLang = (value: unknown): value is Lang =>
  typeof value === 'string' && (ALL_LANGS as string[]).includes(value);

/** Converts an arbitrary value to a language, or returns undefined. */
export const parseLang = (value: unknown): Lang | undefined =>
  isLang(value) ? value : undefined;

/**
 * Language name for the prompt.
 *
 * Models follow a directive like "answer in English" more reliably than
 * "answer in en", so the full name goes into the prompt.
 */
export const LANGUAGE_NAMES: Record<Lang, string> = {
  [Lang.RU]: 'Russian',
  [Lang.EN]: 'English',
  [Lang.DE]: 'German',
};
