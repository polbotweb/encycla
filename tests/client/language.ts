import { beforeEach } from 'vitest';
import { useLanguageStore } from '../../client/i18n';
import type { Language } from '../../shared/languages';

/** Pins the interface language of a test file (the application default is French). */
export function pinLanguage(language: Language = 'en'): void {
  beforeEach(() => {
    useLanguageStore.setState({ language });
  });
}
