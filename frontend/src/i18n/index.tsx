import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { CORE_DE, CORE_EN, CORE_RU } from './core';
import { VIEWS_DE, VIEWS_EN, VIEWS_RU } from './views';
import {
  DEFAULT_LANG,
  LANG_STORAGE_KEY,
  LANGS,
  type Dict,
  type Lang,
  type Vars,
} from './types';

/** Merged dictionaries: the shared keys plus the keys of the screens. */
const DICTS: Record<Lang, Dict> = {
  ru: { ...CORE_RU, ...VIEWS_RU },
  en: { ...CORE_EN, ...VIEWS_EN },
  de: { ...CORE_DE, ...VIEWS_DE },
};

/**
 * The language of the first visit: the stored choice, then the language of
 * the browser.
 */
function detectInitialLang(): Lang {
  try {
    const stored: string | null = window.localStorage.getItem(
      LANG_STORAGE_KEY,
    );

    if (stored && (LANGS as string[]).includes(stored)) {
      return stored as Lang;
    }
  } catch {
    // localStorage is not available (private mode): that is no reason to
    // break the application.
  }

  const browser: string = window.navigator?.language ?? '';
  const short: string = browser.split('-')[0].toLowerCase();

  if ((LANGS as string[]).includes(short)) {
    return short as Lang;
  }

  return DEFAULT_LANG;
}

/**
 * The current language outside of React.
 *
 * Needed by modules that cannot use a hook, for example api.ts that builds
 * an error message.
 */
let currentLang: Lang = detectInitialLang();

/** Substitutes {parameters} in a string. */
function interpolate(template: string, vars?: Vars): string {
  if (!vars) {
    return template;
  }

  return template.replace(
    /\{(\w+)\}/g,
    (match: string, key: string): string =>
      key in vars ? String(vars[key]) : match,
  );
}

/**
 * Translation by key for the current language.
 *
 * If the key is missing in the language of the user, the Russian variant is
 * used, and if it is missing there as well, the key itself: a forgotten
 * translation is visible on the screen instead of disappearing silently.
 */
export function translate(key: string, vars?: Vars): string {
  const value: string | undefined =
    DICTS[currentLang][key] ?? DICTS[DEFAULT_LANG][key] ?? key;

  return interpolate(value, vars);
}

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Vars) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: DEFAULT_LANG,
  setLang: (): void => {},
  t: translate,
});

/**
 * Provider of the interface language.
 *
 * The chosen language is sent to the chat together with the request: the
 * assistant answers in the same language as the interface.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => detectInitialLang());

  useEffect(() => {
    document.documentElement.lang = lang;

    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // The choice could not be saved: the language still applies to this
      // session.
    }
  }, [lang]);

  const setLang = useCallback((next: Lang): void => {
    // The language changes immediately, before the repaint: otherwise the
    // text on the screen would stay in the old language for a moment.
    currentLang = next;
    setLangState(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Vars): string => {
      const value: string | undefined =
        DICTS[lang][key] ?? DICTS[DEFAULT_LANG][key] ?? key;

      return interpolate(value, vars);
    },
    [lang],
  );

  const value: I18nContextValue = useMemo(
    (): I18nContextValue => ({ lang, setLang, t }),
    [lang, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Access to the language and to the translation. */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

/** Translation function. */
export function useT(): (key: string, vars?: Vars) => string {
  return useContext(I18nContext).t;
}

/** Current language of the interface. */
export function useLang(): Lang {
  return useContext(I18nContext).lang;
}

export { LANGS, LANG_SHORT, LANG_LABELS } from './types';
export type { Lang, Vars } from './types';
