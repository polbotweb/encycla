// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../../client/App';
import {
  DICTIONARIES,
  LANGUAGE_QUERY_PARAM,
  LANGUAGE_STORAGE_KEY,
  errorMessage,
  labelFor,
  resolveInitialLanguage,
  translate,
  useLanguageStore,
  type MessageKey,
} from '../../client/i18n';
import { useGameStore } from '../../client/store/gameStore';
import { useUiStore } from '../../client/store/uiStore';
import { LANGUAGES, LANGUAGE_DIRECTION, type Language } from '../../shared/languages';
import type { PublicRoomState } from '../../shared/types';

const KEYS = Object.keys(DICTIONARIES.fr) as MessageKey[];

function texts(language: Language, key: MessageKey): string[] {
  const message = DICTIONARIES[language][key];
  return typeof message === 'string' ? [message] : Object.values(message);
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1] as string).sort();
}

describe('dictionaries', () => {
  it.each(LANGUAGES)('%s has exactly the keys of the French master', (language) => {
    expect(Object.keys(DICTIONARIES[language]).sort()).toEqual([...KEYS].sort());
  });

  it.each(LANGUAGES)('%s has no empty message', (language) => {
    for (const key of KEYS) {
      for (const text of texts(language, key)) expect(text.trim(), key).not.toBe('');
    }
  });

  it('keeps the same placeholders in every language', () => {
    for (const key of KEYS) {
      const reference = DICTIONARIES.fr[key];
      const expected = placeholders(
        typeof reference === 'string' ? reference : reference.other,
      ).filter((name) => name !== 'count' || typeof reference === 'string');
      for (const language of ['en', 'ar'] as const) {
        const message = DICTIONARIES[language][key];
        for (const text of typeof message === 'string' ? [message] : Object.values(message)) {
          const found = placeholders(text).filter((name) => name !== 'count');
          expect(found, `${language}:${key}`).toEqual(expected.filter((name) => name !== 'count'));
        }
      }
    }
  });

  it('uses plural forms in the same places, with the CLDR categories of the language', () => {
    for (const key of KEYS) {
      const reference = DICTIONARIES.fr[key];
      for (const language of ['en', 'ar'] as const) {
        const message = DICTIONARIES[language][key];
        expect(typeof message === 'string', `${language}:${key}`).toBe(
          typeof reference === 'string',
        );
        if (typeof message === 'string') continue;
        expect(message.other, `${language}:${key}`).toBeTruthy();
        if (language === 'ar') {
          for (const form of ['zero', 'one', 'two', 'few', 'many'] as const) {
            expect(message[form], `ar:${key}:${form}`).toBeTruthy();
          }
        }
      }
    }
  });

  it('really translates: Arabic is written in Arabic script, English differs from French', () => {
    const arabic = /[\u0600-\u06FF]/;
    const latinOnly: string[] = [];
    const sameAsFrench: string[] = [];
    for (const key of KEYS) {
      if (!texts('ar', key).every((text) => arabic.test(text))) latinOnly.push(key);
      if (JSON.stringify(DICTIONARIES.en[key]) === JSON.stringify(DICTIONARIES.fr[key])) {
        sameAsFrench.push(key);
      }
    }
    // Only brand names, symbols and identical-looking labels may stay unchanged.
    expect(latinOnly.length / KEYS.length).toBeLessThan(0.03);
    expect(sameAsFrench.length / KEYS.length).toBeLessThan(0.1);
  });
});

describe('translate', () => {
  it('interpolates and keeps unknown placeholders visible', () => {
    expect(translate('question.counter', { index: 3, total: 20 }, 'fr')).toBe('Question 3 sur 20');
    expect(translate('question.counter', { index: 3, total: 20 }, 'en')).toBe('Question 3 of 20');
    expect(translate('question.counter', { index: 3, total: 20 }, 'ar')).toBe('السؤال 3 من 20');
  });

  it('picks plural forms per language rules', () => {
    const key = KEYS.find((candidate) => typeof DICTIONARIES.fr[candidate] !== 'string');
    expect(key).toBeDefined();
    const message = (language: Language, count: number) =>
      translate(key as MessageKey, { count }, language).replace(String(count), '#');
    // French: 0 and 1 are singular, English: only 1.
    expect(message('fr', 0)).toBe(message('fr', 1));
    expect(message('fr', 2)).not.toBe(message('fr', 1));
    expect(message('en', 0)).toBe(message('en', 2));
    expect(message('en', 1)).not.toBe(message('en', 2));
    // Arabic distinguishes 0, 1, 2, 3–10, 11–99 and 100.
    const forms = [0, 1, 2, 3, 11, 100].map((count) => message('ar', count));
    expect(new Set(forms).size).toBe(6);
    expect(message('ar', 5)).toBe(message('ar', 10));
    expect(message('ar', 11)).toBe(message('ar', 99));
  });

  it('maps API error codes and falls back to the internal error', () => {
    expect(errorMessage('ROOM_NOT_FOUND', 'ar')).toBe(translate('error.ROOM_NOT_FOUND', {}, 'ar'));
    expect(errorMessage('NOPE', 'en')).toBe(translate('error.INTERNAL_ERROR', {}, 'en'));
    expect(errorMessage(undefined, 'fr')).toBe(translate('error.INTERNAL_ERROR', {}, 'fr'));
  });

  it('labels modes and categories in each language and shows unknown values as they are', () => {
    expect(labelFor('category', 'Fauna', 'fr')).not.toBe(labelFor('category', 'Fauna', 'en'));
    expect(labelFor('category', 'Fauna', 'ar')).toMatch(/[\u0600-\u06FF]/);
    expect(labelFor('category', 'Atlantis', 'ar')).toBe('Atlantis');
  });
});

describe('resolveInitialLanguage', () => {
  it('defaults to French, ignoring the browser language', () => {
    Object.defineProperty(window.navigator, 'language', { value: 'ar-EG', configurable: true });
    expect(resolveInitialLanguage('', null)).toBe('fr');
  });
  it('prefers the URL over the saved choice, and ignores unknown values', () => {
    expect(resolveInitialLanguage('?lang=ar', 'en')).toBe('ar');
    expect(resolveInitialLanguage('', 'en')).toBe('en');
    expect(resolveInitialLanguage('?lang=de', 'en')).toBe('en');
    expect(resolveInitialLanguage('?lang=de', 'zz')).toBe('fr');
  });
});

describe('language store', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/?mode=join');
    localStorage.clear();
    act(() => useLanguageStore.getState().setLanguage('fr'));
    localStorage.clear();
  });

  it('persists the choice in localStorage and the URL and sets <html lang dir>', () => {
    act(() => useLanguageStore.getState().setLanguage('ar'));
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ar');
    const url = new URL(window.location.href);
    expect(url.searchParams.get(LANGUAGE_QUERY_PARAM)).toBe('ar');
    expect(url.searchParams.get('mode')).toBe('join');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.title).toBe(translate('app.documentTitle', {}, 'ar'));

    act(() => useLanguageStore.getState().setLanguage('en'));
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });
});

const ME = 'p-me';

function room(language: Language): PublicRoomState {
  const now = Date.now();
  const options = ['Carnac', 'Stonehenge', 'Avebury', 'Newgrange'];
  return {
    stateVersion: 3,
    serverNow: now,
    roomCode: 'ABCDEF',
    mode: 'CLASSIC',
    difficulty: null,
    category: null,
    language,
    isPublic: false,
    isTikTok: false,
    isSolo: false,
    tiktokConnected: false,
    phase: 'QUESTION',
    pausedFrom: null,
    level: 1,
    totalLevels: 10,
    questionIndex: 0,
    questionsPerLevel: 20,
    totalQuestionsAnswered: 0,
    phaseStartedAt: now,
    phaseEndsAt: now + 20_000,
    pausedAt: null,
    remainingMs: null,
    phaseToken: 't',
    hostId: ME,
    matchId: null,
    settings: {
      maxPlayers: 8,
      timerMs: 20_000,
      lifePolicy: 'persist',
      articlePolicy: 'manual',
      autoAdvanceMs: null,
      isTikTok: false,
      isPublic: false,
    },
    players: [
      {
        id: ME,
        pseudo: 'علي',
        displayName: 'علي',
        avatar: '🦊',
        score: 0,
        lives: 3,
        streak: 0,
        bestStreak: 0,
        correctCount: 0,
        wrongCount: 0,
        timeoutCount: 0,
        totalResponseMs: 0,
        isReady: true,
        status: 'CONNECTED',
        isHost: true,
        joinedAt: 0,
        hasAnsweredQuestionId: null,
      },
    ],
    question: {
      id: 'q1',
      questionText: 'Quel est ce monument ?',
      options,
      image: { url: '/img/AbCdEfGhIjKlMnOpQrStUv', alt: 'Pierres dressées' },
    },
    reveal: null,
    results: null,
    finalRanking: null,
    winnerId: null,
  } as PublicRoomState;
}

async function violations(container: HTMLElement): Promise<string[]> {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
}

describe('rendered application', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    act(() => useLanguageStore.getState().setLanguage('fr'));
    useGameStore.getState().reset();
    useUiStore.getState().setScreen('home');
  });
  afterEach(cleanup);

  it('is French by default and switches language from the header', async () => {
    render(<App />);
    expect(document.documentElement.lang).toBe('fr');
    const switcher = (await screen.findByTestId('language-switcher')) as HTMLSelectElement;
    expect(switcher.value).toBe('fr');
    expect(screen.getByLabelText(translate('home.pseudo', {}, 'fr'))).toBeTruthy();

    fireEvent.change(switcher, { target: { value: 'ar' } });
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByLabelText(translate('home.pseudo', {}, 'ar'))).toBeTruthy();

    fireEvent.change(switcher, { target: { value: 'en' } });
    expect(document.documentElement.dir).toBe('ltr');
    expect(screen.getByLabelText(translate('home.pseudo', {}, 'en'))).toBeTruthy();
  });

  it.each(LANGUAGES)('%s: home and question pass axe and carry lang and dir', async (language) => {
    act(() => useLanguageStore.getState().setLanguage(language));
    const { container } = render(<App />);
    expect(document.documentElement.lang).toBe(language);
    expect(document.documentElement.dir).toBe(LANGUAGE_DIRECTION[language]);
    expect(await violations(container)).toEqual([]);

    // The question content follows the room language, whatever the interface language is.
    const content: Language = language === 'ar' ? 'fr' : 'ar';
    act(() => {
      useGameStore.getState().setPlayer(ME);
      useGameStore.getState().applyRoomState(room(content));
    });
    const title = await screen.findByText('Quel est ce monument ?');
    const holder = title.closest('[lang]');
    expect(holder?.getAttribute('lang')).toBe(content);
    expect(holder?.getAttribute('dir')).toBe(LANGUAGE_DIRECTION[content]);
    expect(await violations(container)).toEqual([]);
  });

  it('keeps room code and option letters left-to-right inside an RTL page', async () => {
    act(() => useLanguageStore.getState().setLanguage('ar'));
    render(<App />);
    act(() => {
      useGameStore.getState().setPlayer(ME);
      useGameStore.getState().applyRoomState({ ...room('ar'), phase: 'LOBBY', question: null });
    });
    const code = await screen.findByTestId('room-code');
    expect(code.closest('[dir]')?.getAttribute('dir')).toBe('ltr');
  });

  it('shows an article from another Wikipedia in its own language, with a notice and a link', async () => {
    act(() => useLanguageStore.getState().setLanguage('ar'));
    const { container } = render(<App />);
    const base = room('ar');
    act(() => {
      useGameStore.getState().setPlayer(ME);
      useGameStore.getState().applyRoomState({
        ...base,
        phase: 'ARTICLE',
        question: null,
        reveal: {
          questionId: 'q1',
          subject: 'Typhula',
          questionText: 'ما هذا الفطر؟',
          options: ['A', 'B', 'Typhula', 'D'],
          correctIndex: 2,
          explanation: 'الإجابة الصحيحة: Typhula. المصدر: ويكيبيديا.',
          articleTitle: 'Typhula',
          articleBody: 'Typhula is a genus of fungi in the family Typhulaceae.',
          textLanguage: 'en',
          articleUrl: 'https://en.wikipedia.org/w/index.php?title=Typhula&oldid=1',
          subjectForm: { lang: 'la', scientific: true },
          optionForms: [
            { lang: 'la', scientific: true },
            { lang: 'la', scientific: true },
            { lang: 'la', scientific: true },
            { lang: 'la', scientific: true },
          ],
          image: null,
        },
      } as PublicRoomState);
    });
    const heading = await screen.findByRole('heading', { name: 'Typhula' });
    const holder = heading.closest('[lang]');
    expect(holder?.getAttribute('lang')).toBe('en');
    expect(holder?.getAttribute('dir')).toBe('ltr');
    const notice = screen.getByTestId('article-fallback-notice').textContent ?? '';
    expect(notice).toContain('الإنجليزية');
    expect(notice).not.toMatch(/fran/i);
    const link = screen.getByRole('link', { name: /ويكيبيديا/ });
    expect(link.getAttribute('href')).toBe(
      'https://en.wikipedia.org/w/index.php?title=Typhula&oldid=1',
    );
    expect(await violations(container)).toEqual([]);
  });

  it('renders scientific names in Latin italics, left-to-right, isolated in an Arabic room', async () => {
    act(() => useLanguageStore.getState().setLanguage('ar'));
    const { container } = render(<App />);
    const base = room('ar');
    const options = [
      'Amanita muscaria',
      'Boletus edulis',
      'Morchella esculenta',
      'Russula emetica',
    ];
    act(() => {
      useGameStore.getState().setPlayer(ME);
      useGameStore.getState().applyRoomState({
        ...base,
        question: {
          ...base.question!,
          questionText: 'ما هذا الفطر؟',
          options,
          optionForms: options.map(() => ({ lang: 'la', scientific: true })),
        },
      } as PublicRoomState);
    });
    for (const option of options) {
      const term = (await screen.findByText(option)).closest('bdi');
      expect(term, option).not.toBeNull();
      expect(term?.getAttribute('lang')).toBe('la');
      expect(term?.getAttribute('dir')).toBe('ltr');
      expect(term?.className).toContain('italic');
    }
    expect(await violations(container)).toEqual([]);
  });

  it('isolates an original name in its own script, upright, in an Arabic room', async () => {
    act(() => useLanguageStore.getState().setLanguage('ar'));
    render(<App />);
    const base = room('ar');
    act(() => {
      useGameStore.getState().setPlayer(ME);
      useGameStore.getState().applyRoomState({
        ...base,
        question: {
          ...base.question!,
          questionText: 'ما هذا المبنى؟',
          options: ['قصر الحمراء', 'Château de Chambord', 'برج إيفل', 'كاتدرائية نوتردام'],
          optionForms: [null, { lang: 'fr' }, null, null],
        },
      } as PublicRoomState);
    });
    const term = (await screen.findByText('Château de Chambord')).closest('bdi');
    expect(term?.getAttribute('lang')).toBe('fr');
    expect(term?.getAttribute('dir')).toBe('ltr');
    expect(term?.className ?? '').not.toContain('italic');
    expect(screen.getByText('قصر الحمراء').closest('bdi')).toBeNull();
  });
});
