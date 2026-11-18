// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Narrator,
  VoiceNotice,
  VoiceStatus,
  VoiceSettingsPanel,
  VoiceSuggestion,
  VoiceToggleButton,
} from '../../client/components/game/Voice';
import {
  articleIntro,
  defaultVoiceSettings,
  loadVoiceSettings,
  narrationFor,
  pickVoice,
  timeCue,
  useVoiceStore,
  watchVoices,
  type VoiceInfo,
} from '../../client/lib/speech';
import { QUESTION, REVEAL, room } from './fixtures';
import { pinLanguage } from './language';

pinLanguage('en');

const VOICES: VoiceInfo[] = [
  { voiceURI: 'fr-1', name: 'Amélie', lang: 'fr-FR', localService: true },
  { voiceURI: 'en-1', name: 'Daniel', lang: 'en-GB' },
  { voiceURI: 'en-2', name: 'Samantha', lang: 'en-US', default: true },
];

class FakeUtterance {
  text: string;
  voice: VoiceInfo | null = null;
  lang = '';
  rate = 1;
  volume = 1;
  onerror: ((event: { error: string }) => void) | null = null;
  onstart: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

class FakeSynth {
  voices: VoiceInfo[];
  spoken: FakeUtterance[] = [];
  cancels = 0;
  speaking = false;
  pending = false;
  listeners = new Set<() => void>();
  constructor(voices: VoiceInfo[]) {
    this.voices = voices;
  }
  getVoices = () => this.voices;
  speak = (utterance: FakeUtterance) => this.spoken.push(utterance);
  cancel = () => {
    this.cancels += 1;
  };
  addEventListener = (_: string, listener: () => void) => this.listeners.add(listener);
  removeEventListener = (_: string, listener: () => void) => this.listeners.delete(listener);
}

let synth: FakeSynth;

function install(
  voices: VoiceInfo[] = VOICES,
  scope: 'player' | 'overlay' | 'console' = 'overlay',
  search = '',
) {
  synth = new FakeSynth(voices);
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  useVoiceStore.setState({ missing: null, blocked: false });
  useVoiceStore.getState().init(scope, search);
}

const texts = () => synth.spoken.map((utterance) => utterance.text);

beforeEach(() => {
  localStorage.clear();
  install();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('voice settings', () => {
  it('is on for the overlay and the console, off for players', () => {
    expect(defaultVoiceSettings('overlay').enabled).toBe(true);
    expect(defaultVoiceSettings('console').enabled).toBe(true);
    expect(defaultVoiceSettings('player').enabled).toBe(false);
  });

  it('persists per scope and reads ?voice, ?rate and ?volume from the URL', () => {
    install(VOICES, 'player');
    useVoiceStore.getState().update({ enabled: true, rate: 1.4, volume: 0.5 });
    useVoiceStore.getState().setVoice('en', 'en-1');
    const saved = loadVoiceSettings('player');
    expect(saved).toMatchObject({ enabled: true, rate: 1.4, volume: 0.5, voices: { en: 'en-1' } });
    expect(loadVoiceSettings('overlay').rate).toBe(1);
    expect(loadVoiceSettings('overlay', '?voice=0').enabled).toBe(false);
    expect(loadVoiceSettings('player', '?voice=1&rate=9&volume=-2&article=1')).toMatchObject({
      enabled: true,
      rate: 2,
      volume: 0,
      readArticle: true,
    });
    useVoiceStore.getState().setVoice('en', null);
    expect(loadVoiceSettings('player').voices).toEqual({});
  });

  it('survives a corrupted saved value', () => {
    localStorage.setItem('encycla.voice.player.v1', '{oops');
    expect(loadVoiceSettings('player')).toEqual(defaultVoiceSettings('player'));
  });
});

describe('pickVoice', () => {
  it('prefers the chosen voice, then the default, then a local one; never another language', () => {
    expect(pickVoice(VOICES, 'en', 'en-1')?.name).toBe('Daniel');
    expect(pickVoice(VOICES, 'en')?.name).toBe('Samantha');
    expect(pickVoice(VOICES, 'fr', 'en-1')?.name).toBe('Amélie');
    expect(pickVoice(VOICES, 'ar')).toBeNull();
    expect(pickVoice([{ voiceURI: 'x', name: 'X', lang: 'en_AU' }], 'en')?.name).toBe('X');
  });
});

describe('narrationFor', () => {
  const question = room('QUESTION', { question: QUESTION, questionIndex: 2 });

  it('reads the question and the four answers with their letters', () => {
    const narration = narrationFor(room('COUNTDOWN'), question);
    expect(narration?.interrupt).toBe(true);
    expect(narration?.segments.map((segment) => segment.text)).toEqual([
      `Question 3 of 20. ${QUESTION.questionText}`,
      'A: Carnac.',
      'B: Stonehenge.',
      'C: Avebury.',
      'D: Newgrange.',
    ]);
    expect(narrationFor(question, { ...question, stateVersion: 11 })).toBeNull();
  });

  it('reads a scientific name on its own, with a room-language fallback for Latin script', () => {
    const latin = room('QUESTION', {
      question: { ...QUESTION, optionForms: [{ lang: 'la', scientific: true }, null, null, null] },
    });
    const segments = narrationFor(null, latin)?.segments ?? [];
    expect(segments.slice(1, 3)).toEqual([
      { text: 'A:', lang: 'en' },
      { text: 'Carnac', lang: 'la', fallback: 'en' },
    ]);
    const arabic = room('QUESTION', {
      language: 'ar',
      question: { ...QUESTION, optionForms: [{ lang: 'la', scientific: true }, null, null, null] },
    });
    expect((narrationFor(null, arabic)?.segments ?? [])[2]).toEqual({ text: 'Carnac', lang: 'la' });
  });

  it('says the correct answer at the reveal, then optionally the article intro', () => {
    const reveal = room('REVEAL', { question: null, reveal: REVEAL });
    expect(narrationFor(question, reveal)?.segments).toEqual([
      { text: 'The answer is B, Stonehenge.', lang: 'en' },
    ]);
    const formed = room('REVEAL', {
      reveal: { ...REVEAL, optionForms: [null, { lang: 'la', scientific: true }, null, null] },
    });
    expect(narrationFor(question, formed)?.segments[0]).toEqual({
      text: 'The answer is B.',
      lang: 'en',
    });
    const article = room('ARTICLE', { reveal: REVEAL });
    expect(narrationFor(reveal, article)).toBeNull();
    expect(narrationFor(reveal, article, { readArticle: true })?.segments).toEqual([
      { text: 'Stonehenge is a prehistoric monument.', lang: 'en' },
    ]);
  });

  it('stops on pause and does not repeat after resuming', () => {
    const paused = room('PAUSED', { pausedFrom: 'QUESTION', question: QUESTION });
    expect(narrationFor(question, paused)).toEqual({ interrupt: true, segments: [] });
    expect(narrationFor(paused, question)).toBeNull();
    expect(narrationFor(paused, paused)).toBeNull();
  });

  it('announces the level and the end of the match', () => {
    expect(narrationFor(null, room('LEVEL_COMPLETE'))?.segments[0]?.text).toBe('Level 1 complete.');
    expect(narrationFor(null, room('MATCH_OVER'))?.segments[0]?.text).toBe('Match complete.');
    expect(narrationFor(null, room('COUNTDOWN'))).toBeNull();
  });
});

describe('timeCue and articleIntro', () => {
  it('speaks 10 s, 5 s and time up, only when busy is free', () => {
    expect(timeCue(10_400, 9_900, 'en')?.segments[0]?.text).toBe('10 seconds');
    expect(timeCue(5_100, 4_900, 'fr')?.segments[0]?.text).toBe('5 secondes');
    expect(timeCue(300, 0, 'en')).toMatchObject({ skipIfBusy: true });
    expect(timeCue(9_000, 8_000, 'en')).toBeNull();
    expect(timeCue(null, 8_000, 'en')).toBeNull();
    expect(timeCue(8_000, 9_000, 'en')).toBeNull();
  });

  it('keeps the first sentence, at most ~200 characters', () => {
    expect(articleIntro('One. Two.')).toBe('One.');
    expect(articleIntro('No full stop')).toBe('No full stop');
    expect(articleIntro(`${'word '.repeat(60)}end.`).length).toBeLessThanOrEqual(201);
  });
});

describe('the speaker', () => {
  it('queues utterances with the voice, rate and volume of the settings', () => {
    useVoiceStore.getState().update({ rate: 1.5, volume: 0.6 });
    const result = useVoiceStore
      .getState()
      .speak(narrationFor(null, room('QUESTION', { question: QUESTION }))!, 'en');
    expect(result).toBe('spoken');
    expect(synth.cancels).toBeGreaterThan(0);
    expect(texts()).toHaveLength(5);
    expect(synth.spoken[0]).toMatchObject({ lang: 'en-US', rate: 1.5, volume: 0.6 });
  });

  it('skips a Latin name without a Latin voice in Arabic, reads it in English', () => {
    install([...VOICES, { voiceURI: 'ar-1', name: 'Maged', lang: 'ar-SA' }]);
    const forms = [{ lang: 'la', scientific: true as const }, null, null, null];
    const ar = room('QUESTION', { language: 'ar', question: { ...QUESTION, optionForms: forms } });
    useVoiceStore.getState().speak(narrationFor(null, ar)!, 'ar');
    expect(texts()).not.toContain('Carnac');
    synth.spoken = [];
    const en = room('QUESTION', { question: { ...QUESTION, optionForms: forms } });
    useVoiceStore.getState().speak(narrationFor(null, en)!, 'en');
    expect(texts()).toContain('Carnac');
  });

  it('never reads Arabic questions with another voice: it reports the missing voice', () => {
    const ar = room('QUESTION', { language: 'ar', question: QUESTION });
    expect(useVoiceStore.getState().speak(narrationFor(null, ar)!, 'ar')).toBe('missing-voice');
    expect(synth.spoken).toHaveLength(0);
    expect(useVoiceStore.getState().missing).toBe('ar');
    render(<VoiceNotice language="ar" />);
    expect(screen.getByTestId('voice-missing').textContent).toContain('No Arabic voice');
  });

  it('is silent when off, unsupported without speechSynthesis, busy for time marks', () => {
    useVoiceStore.getState().update({ enabled: false });
    expect(useVoiceStore.getState().speak(timeCue(6_000, 5_000, 'en')!, 'en')).toBe('disabled');
    useVoiceStore.getState().update({ enabled: true });
    synth.speaking = true;
    expect(useVoiceStore.getState().speak(timeCue(6_000, 5_000, 'en')!, 'en')).toBe('busy');
    expect(useVoiceStore.getState().speak({ interrupt: true, segments: [] }, 'en')).toBe('empty');
    vi.stubGlobal('speechSynthesis', undefined);
    expect(useVoiceStore.getState().speak(timeCue(6_000, 5_000, 'en')!, 'en')).toBe('unsupported');
  });

  it('shows the autoplay notice when the browser refuses, and a click unlocks it', () => {
    useVoiceStore
      .getState()
      .speak({ interrupt: false, segments: [{ text: 'Hi', lang: 'en' }] }, 'en');
    act(() => synth.spoken[0]?.onerror?.({ error: 'not-allowed' }));
    expect(useVoiceStore.getState().blocked).toBe(true);
    render(<VoiceNotice language="en" overlay />);
    fireEvent.click(screen.getByRole('button', { name: /click/i }));
    expect(useVoiceStore.getState().blocked).toBe(false);
    expect(texts()).toContain('Voice on.');
    act(() => synth.spoken[1]?.onstart?.());
  });

  it('refreshes the voice list on voiceschanged', () => {
    synth.voices = [];
    const stop = watchVoices();
    expect(useVoiceStore.getState().voices).toEqual([]);
    synth.voices = VOICES;
    for (const listener of synth.listeners) listener();
    expect(useVoiceStore.getState().voices).toHaveLength(3);
    stop();
    expect(synth.listeners.size).toBe(0);
  });
});

describe('voice components', () => {
  it('Narrator reads each new phase once and cancels on unmount', () => {
    const view = render(<Narrator room={room('COUNTDOWN')} clockOffset={0} />);
    view.rerender(<Narrator room={room('QUESTION', { question: QUESTION })} clockOffset={0} />);
    expect(texts()).toContain('B: Stonehenge.');
    view.rerender(<Narrator room={room('REVEAL', { reveal: REVEAL })} clockOffset={0} />);
    expect(texts()).toContain('The answer is B, Stonehenge.');
    const cancels = synth.cancels;
    view.unmount();
    expect(synth.cancels).toBeGreaterThan(cancels);
  });

  it('Narrator speaks the time marks and stays silent when silenced', () => {
    vi.useFakeTimers();
    try {
      const start = Date.now();
      const question = room('QUESTION', { question: QUESTION, phaseEndsAt: start + 10_300 });
      render(<Narrator room={question} clockOffset={0} />);
      synth.spoken = [];
      act(() => vi.advanceTimersByTime(600));
      expect(texts()).toEqual(['10 seconds']);
      cleanup();
      synth.spoken = [];
      render(<Narrator room={room('QUESTION', { question: QUESTION })} clockOffset={0} silenced />);
      expect(synth.spoken).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('the header toggle and the settings panel change and persist the settings', () => {
    install(VOICES, 'player');
    render(
      <>
        <VoiceToggleButton />
        <VoiceSettingsPanel language="en" />
      </>,
    );
    const toggle = screen.getByTestId('voice-toggle');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('switch')).toHaveProperty('checked', true);
    fireEvent.change(screen.getByLabelText(/Voice \(English\)/), { target: { value: 'en-1' } });
    fireEvent.change(screen.getByLabelText(/Speed/), { target: { value: '1.3' } });
    fireEvent.change(screen.getByLabelText(/Volume/), { target: { value: '0.4' } });
    fireEvent.click(screen.getByLabelText(/start of the article/));
    synth.spoken = [];
    fireEvent.click(screen.getByRole('button', { name: 'Test the voice' }));
    expect(synth.spoken[0]).toMatchObject({
      text: 'Hello! This voice will read the questions.',
      rate: 1.3,
      volume: 0.4,
    });
    expect(synth.spoken[0]?.voice?.name).toBe('Daniel');
    expect(loadVoiceSettings('player')).toMatchObject({
      enabled: true,
      readArticle: true,
      voices: { en: 'en-1' },
    });
    fireEvent.click(screen.getByRole('switch'));
    expect(useVoiceStore.getState().settings.enabled).toBe(false);
  });

  it('the home suggestion turns the voice on once, or goes away for good', () => {
    install(VOICES, 'player');
    const view = render(<VoiceSuggestion />);
    fireEvent.click(screen.getByRole('button', { name: 'No thanks' }));
    expect(screen.queryByTestId('voice-suggestion')).toBeNull();
    view.unmount();
    render(<VoiceSuggestion />);
    expect(screen.queryByTestId('voice-suggestion')).toBeNull();
    cleanup();
    localStorage.clear();
    install(VOICES, 'player');
    render(<VoiceSuggestion />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn the voice on' }));
    expect(useVoiceStore.getState().settings.enabled).toBe(true);
    expect(screen.queryByTestId('voice-suggestion')).toBeNull();
  });

  it('without speech synthesis: no toggle, a notice where the voice is expected', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    useVoiceStore.getState().init('overlay', '');
    render(
      <>
        <VoiceToggleButton />
        <VoiceNotice language="en" />
      </>,
    );
    expect(screen.queryByTestId('voice-toggle')).toBeNull();
    expect(screen.getByText('This browser offers no speech synthesis voice.')).toBeTruthy();
  });
  it('a browser without voices (OBS): silent overlay during the game, status in the lobby', () => {
    install([], 'overlay');
    const result = useVoiceStore
      .getState()
      .speak({ interrupt: false, segments: [{ text: 'Hi', lang: 'en' }] }, 'en');
    expect(result).toBe('unsupported');
    expect(useVoiceStore.getState().noVoices).toBe(true);
    const view = render(
      <>
        <VoiceNotice language="en" overlay />
        <VoiceStatus language="en" />
      </>,
    );
    expect(view.container.textContent).toBe('No voice in this browser');
    cleanup();
    render(<VoiceNotice language="en" />);
    expect(screen.getByText('This browser offers no speech synthesis voice.')).toBeTruthy();
    cleanup();
    synth.voices = VOICES;
    useVoiceStore.getState().refreshVoices();
    expect(useVoiceStore.getState().noVoices).toBe(false);
    render(<VoiceStatus language="en" />);
    expect(screen.getByTestId('voice-status').textContent).toBe('Voice: Samantha');
    useVoiceStore.getState().update({ enabled: false });
    cleanup();
    const off = render(<VoiceStatus language="en" />);
    expect(off.container.textContent).toBe('');
  });
});
