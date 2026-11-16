/** Languages of the game. French is the default; English and Arabic are always available. */
export const LANGUAGES = ['fr', 'en', 'ar'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'fr';

/** Languages that live in `question.translations` (the top-level question fields are French). */
export const TRANSLATED_LANGUAGES = ['en', 'ar'] as const;
export type TranslatedLanguage = (typeof TRANSLATED_LANGUAGES)[number];

export type TextDirection = 'ltr' | 'rtl';

export const LANGUAGE_DIRECTION: Record<Language, TextDirection> = {
  fr: 'ltr',
  en: 'ltr',
  ar: 'rtl',
};

/** Names of the languages, each written in its own language (used by the switcher). */
export const LANGUAGE_NAMES: Record<Language, string> = {
  fr: 'Français',
  en: 'English',
  ar: 'العربية',
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}
