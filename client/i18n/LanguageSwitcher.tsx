import { LANGUAGES, LANGUAGE_NAMES, isLanguage } from '../../shared/languages';
import { useTranslation } from './index';

/** Language picker for the header. Each language is written in its own language. */
export function LanguageSwitcher() {
  const { t, language, setLanguage } = useTranslation();
  return (
    <select
      value={language}
      aria-label={t('lang.switcherAria')}
      data-testid="language-switcher"
      onChange={(event) => {
        if (isLanguage(event.target.value)) setLanguage(event.target.value);
      }}
      className="min-h-[44px] rounded-md border border-line-strong bg-bg px-2 text-ink"
    >
      {LANGUAGES.map((code) => (
        <option key={code} value={code} lang={code}>
          {LANGUAGE_NAMES[code]}
        </option>
      ))}
    </select>
  );
}
