import { LANG_LABELS, LANG_SHORT, LANGS, useI18n, type Lang } from './index';

/**
 * Widget for choosing the language.
 *
 * The language is applied to the whole interface at once and is sent to the
 * chat with the request, so the assistant answers in the same language.
 */
export default function LanguageSwitch({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { lang, setLang } = useI18n();

  return (
    <div
      className={`lang-switch ${compact ? 'lang-switch--compact' : ''}`}
      role="group"
      aria-label="Language"
    >
      {LANGS.map((option: Lang) => (
        <button
          key={option}
          type="button"
          className={`lang-switch__btn ${lang === option ? 'active' : ''}`}
          onClick={() => setLang(option)}
          aria-pressed={lang === option}
          title={LANG_LABELS[option]}
        >
          {LANG_SHORT[option]}
        </button>
      ))}
    </div>
  );
}
