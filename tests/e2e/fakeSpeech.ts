import type { BrowserContext, Page } from '@playwright/test';

/**
 * A recording `speechSynthesis` for the tests (headless browsers have no voices): French and
 * English voices only, so Arabic exercises the "no voice on this device" notice.
 */
export async function installFakeSpeech(
  target: Page | BrowserContext,
  langs: string[] = ['fr-FR', 'en-US'],
): Promise<void> {
  await target.addInitScript((voiceLangs: string[]) => {
    const spoken: { text: string; lang: string }[] = [];
    const voices = voiceLangs.map((lang, index) => ({
      voiceURI: `fake-${lang}`,
      name: `Fake ${lang}`,
      lang,
      default: index === 0,
      localService: true,
    }));
    class Utterance {
      text: string;
      voice: unknown = null;
      lang = '';
      rate = 1;
      volume = 1;
      onstart: (() => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    const synth = {
      speaking: false,
      pending: false,
      cancels: 0,
      getVoices: () => voices,
      speak: (utterance: Utterance) => {
        spoken.push({ text: utterance.text, lang: utterance.lang });
        utterance.onstart?.();
      },
      cancel: () => {
        synth.cancels += 1;
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: Utterance,
      configurable: true,
    });
    (window as unknown as { __spoken: typeof spoken }).__spoken = spoken;
  }, langs);
}

export function spoken(page: Page): Promise<{ text: string; lang: string }[]> {
  return page.evaluate(
    () => (window as unknown as { __spoken: { text: string; lang: string }[] }).__spoken,
  );
}
