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
import { DEFAULT_LANG, type Dict, type Lang, type Vars } from './types';

/** Merged dictionaries: the shared keys plus the keys of the screens. */
const DICTS: Record<Lang, Dict> = {
  ru: { ...CORE_RU, ...VIEWS_RU },
  en: { ...CORE_EN, ...VIEWS_EN },
  de: { ...CORE_DE, ...VIEWS_DE },
};

/**
 * The interface always starts in English: the stored choice and the language
 * of the browser are deliberately ignored. DEFAULT_LANG stays the fallback
 * for keys missing in a dictionary.
 */
const INITIAL_LANG: Lang = 'en';

/**
 * The current language outside of React.
 *
 * Needed by modules that cannot use a hook, for example api.ts that builds
 * an error message.
 */
let currentLang: Lang = INITIAL_LANG;

/** Substitutes {parameters} in a string. */
function interpolate(template: string, vars?: Vars): string {
  if (!vars) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match: string, key: string): string =>
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
  lang: INITIAL_LANG,
  setLang: (): void => {},
  t: translate,
});

/**
 * Provider of the interface language.
 *
 * The chosen language is sent to the chat together with the request: the
 * assistant answers in the same language as the interface. The choice lives
 * until the page is reloaded and is not stored.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(INITIAL_LANG);

  useEffect(() => {
    document.documentElement.lang = lang;
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
