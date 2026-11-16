import { afterEach, describe, expect, it } from 'vitest';
import { startHarness, type Harness } from '../fixtures/harness';

let harness: Harness | null = null;

afterEach(async () => {
  await harness?.close();
  harness = null;
});

async function playQuestion(h: Harness, language?: string) {
  const alice = await h.newPlayer('Alice');
  const body = language === undefined ? { mode: 'CLASSIC' } : { mode: 'CLASSIC', language };
  const created = await h.api('/api/solo', { token: alice.token, body });
  expect(created.status).toBe(201);
  const countdown = await alice.waitFor((state) => state.phase === 'COUNTDOWN');
  h.clock.advance(3000);
  h.server.manager.sweep();
  const state = await alice.waitFor((s) => s.phase === 'QUESTION');
  return { alice, countdown, state, created };
}

describe('room language', () => {
  it('defaults to French when the client sends no language', async () => {
    harness = await startHarness();
    const { countdown, state } = await playQuestion(harness);
    expect(countdown.language).toBe('fr');
    expect(state.language).toBe('fr');
    expect(state.question?.questionText).toMatch(/^Which statement/);
  });

  it.each([
    ['en', /^EN Which statement/, /^EN option/],
    ['ar', /^AR Which statement/, /^AR option/],
  ] as const)(
    'serves the %s question text, options and image alt',
    async (language, text, option) => {
      harness = await startHarness();
      const { state, created } = await playQuestion(harness, language);
      expect(created.status).toBe(201);
      expect(state.language).toBe(language);
      expect(state.question?.questionText).toMatch(text);
      expect(state.question?.options).toHaveLength(4);
      for (const label of state.question?.options ?? []) expect(label).toMatch(option);
    },
  );

  it('reveals the answer in the room language, in the same slot, with the language article', async () => {
    harness = await startHarness();
    const { alice, state } = await playQuestion(harness, 'ar');
    const question = state.question!;
    await alice.emit('ANSWER', { questionId: question.id, choiceIndex: 0 });
    const reveal = await alice.waitFor((s) => s.phase === 'REVEAL');
    expect(reveal.reveal?.options).toEqual(question.options);
    expect(reveal.reveal?.options[reveal.reveal.correctIndex]).toMatch(/^AR option/);
    expect(reveal.reveal?.subject).toMatch(/^AR /);
    expect(reveal.reveal?.articleTitle).toMatch(/^AR /);
    expect(reveal.reveal?.articleBody).toMatch(/^AR /);
    expect(reveal.reveal?.textLanguage).toBe('ar');
  });

  it('rejects an unknown language', async () => {
    harness = await startHarness();
    const alice = await harness.newPlayer('Alice');
    const response = await harness.api('/api/solo', {
      token: alice.token,
      body: { mode: 'CLASSIC', language: 'de' },
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('only matches players who queue for the same language', async () => {
    harness = await startHarness();
    const h = harness;
    const alice = await h.newPlayer('Alice');
    const bob = await h.newPlayer('Bob');
    const carol = await h.newPlayer('Carol');
    const queue = (player: typeof alice, language: string) =>
      h.api('/api/queue', { token: player.token, body: { mode: 'CONTEST', language } });

    expect((await queue(alice, 'fr')).status).toBe(202);
    expect((await queue(bob, 'ar')).status).toBe(202);
    expect(h.server.queue.size()).toBe(2);

    const found = new Promise((resolve) => carol.socket.once('MATCH_FOUND', resolve));
    expect((await queue(carol, 'ar')).status).toBe(202);
    await found;
    expect(h.server.queue.size()).toBe(1);
    const state = await bob.waitFor((s) => s.phase === 'COUNTDOWN');
    expect(state.language).toBe('ar');
  });
});
