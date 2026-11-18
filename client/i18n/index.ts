import { create } from 'zustand';
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  LANGUAGE_DIRECTION,
  isLanguage,
  type Language,
  type TextDirection,
} from '../../shared/languages';
import { safeStorage } from '../lib/storage';
import { ar } from './ar';
import { en } from './en';
import { fr, type MessageKey } from './fr';
import type { Message, MessageParams, PluralForms } from './types';

export type { MessageKey } from './fr';
export type { Message, MessageParams } from './types';
export { LANGUAGES, LANGUAGE_DIRECTION, type Language, type TextDirection };

export const LANGUAGE_STORAGE_KEY = 'encycla.lang.v1';
/** Query parameter that selects the language (`?lang=ar`), kept in the URL when it is chosen. */
export const LANGUAGE_QUERY_PARAM = 'lang';

export const DICTIONARIES: Record<Language, Record<MessageKey, Message>> = { fr, en, ar };

/**
 * Western digits (0–9) in every language, also in Arabic: scores, timers and room codes are the
 * same everywhere, which keeps the game readable on a shared screen and for chat commands.
 */
const LOCALES: Record<Language, string> = { fr: 'fr', en: 'en', ar: 'ar-u-nu-latn' };

/** `?lang=` first, then the saved choice, then French. The browser language is not used. */
export function resolveInitialLanguage(search: string, stored: string | null): Language {
  const fromUrl = new URLSearchParams(search).get(LANGUAGE_QUERY_PARAM);
  if (isLanguage(fromUrl)) return fromUrl;
  if (isLanguage(stored)) return stored;
  return DEFAULT_LANGUAGE;
}

/** Reflects the language on `<html lang dir>` and the document title. */
export function applyDocumentLanguage(language: Language): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.lang = language;
  root.dir = LANGUAGE_DIRECTION[language];
  document.title = lookup(language, 'app.documentTitle') as string;
}

function initialLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  return resolveInitialLanguage(window.location.search, safeStorage.get(LANGUAGE_STORAGE_KEY));
}

interface LanguageState {
  language: Language;
  setLanguage(language: Language): void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: initialLanguage(),
  setLanguage(language) {
    safeStorage.set(LANGUAGE_STORAGE_KEY, language);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set(LANGUAGE_QUERY_PARAM, language);
      window.history.replaceState(window.history.state, '', url);
    }
    applyDocumentLanguage(language);
    set({ language });
  },
}));

applyDocumentLanguage(useLanguageStore.getState().language);

function lookup(language: Language, key: MessageKey): Message {
  return DICTIONARIES[language][key] ?? fr[key] ?? key;
}

function interpolate(template: string, params: MessageParams | undefined): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}

const pluralRules = new Map<Language, Intl.PluralRules>();

function pluralCategory(language: Language, count: number): keyof PluralForms {
  let rules = pluralRules.get(language);
  if (!rules) {
    rules = new Intl.PluralRules(LOCALES[language]);
    pluralRules.set(language, rules);
  }
  return rules.select(count) as keyof PluralForms;
}

/** Translates `key` into `language` (the current one by default). Plural messages read `count`. */
export function translate(
  key: MessageKey,
  params?: MessageParams,
  language: Language = useLanguageStore.getState().language,
): string {
  const message = lookup(language, key);
  if (typeof message === 'string') return interpolate(message, params);
  const count = Number(params?.count ?? 0);
  const form = message[pluralCategory(language, count)] ?? message.other;
  return interpolate(form, params);
}

export type TranslateFn = (key: MessageKey, params?: MessageParams) => string;

export interface Translation {
  t: TranslateFn;
  language: Language;
  dir: TextDirection;
  setLanguage(language: Language): void;
}

/** React hook: re-renders the component when the language changes. */
export function useTranslation(): Translation {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  return {
    t: (key, params) => translate(key, params, language),
    language,
    dir: LANGUAGE_DIRECTION[language],
    setLanguage,
  };
}

const RTL_LANGUAGES = new Set([
  'ar',
  'arc',
  'ckb',
  'dv',
  'fa',
  'he',
  'ps',
  'sd',
  'syr',
  'ug',
  'ur',
  'yi',
]);

/** Writing direction of any language tag (`ar`, `he`… are right-to-left). */
export function directionOf(language: string): TextDirection {
  const base = language.toLowerCase().split('-')[0] ?? '';
  return RTL_LANGUAGES.has(base) ? 'rtl' : 'ltr';
}

/**
 * `lang` / `dir` attributes for text whose language differs from the interface (the questions,
 * an article from another Wikipedia, an original name).
 */
export function contentAttributes<L extends string>(language: L): { lang: L; dir: TextDirection } {
  return { lang: language, dir: directionOf(language) };
}

/** Name of a language in the interface language (`de` → « allemand »), the code as a fallback. */
export function languageName(language: string, interfaceLanguage: Language): string {
  try {
    const names = new Intl.DisplayNames([interfaceLanguage], { type: 'language' });
    return names.of(language) ?? language;
  } catch {
    return language;
  }
}

/** Message for an API error code; unknown codes (and network errors) read as an internal error. */
export function errorMessage(code: string | undefined, language?: Language): string {
  const key = `error.${code ?? 'INTERNAL_ERROR'}` as MessageKey;
  return translate(key in fr ? key : 'error.INTERNAL_ERROR', undefined, language);
}

const KNOWN_KEYS = new Set<string>(Object.keys(fr));

/** Label of a mode, difficulty or category; unknown values are shown as they are. */
export function labelFor(
  kind: 'mode' | 'difficulty' | 'category',
  value: string,
  language?: Language,
): string {
  const key = `${kind}.${value}`;
  return KNOWN_KEYS.has(key) ? translate(key as MessageKey, undefined, language) : value;
}
