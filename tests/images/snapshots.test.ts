import { afterEach, describe, expect, it } from 'vitest';
import type { QuestionRecord } from '../../shared/schemas';
import { ImageService } from '../../server/images/service';
import { startHarness, type Harness } from '../fixtures/harness';
import { TEST_QUESTIONS } from '../fixtures/questions';
import { jpegWithMetadata } from './fixtures';

let harness: Harness | null = null;

afterEach(async () => {
  await harness?.close();
  harness = null;
});

/** File names that spell the answer, like most Commons pictures do. */
const WITH_IMAGES: QuestionRecord[] = TEST_QUESTIONS.map((question) => {
  const file = `${question.subject.replace(/ /g, '_')}_photo.jpg`;
  return {
    ...question,
    image: {
      url: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${file}/960px-${file}`,
      alt: 'Picture to identify',
      credit: `Photographer of ${question.subject}`,
      license: 'CC BY-SA 4.0',
      sourceUrl: `https://commons.wikimedia.org/wiki/File:${file}`,
      author: `Author of ${question.subject}`,
    },
  };
});

describe('snapshots sent during a question (D-107)', () => {
  it('carry no subject, bank id, file name, credit or Commons host before the reveal', async () => {
    const images = new ImageService({
      fetcher: async () => new Response(new Uint8Array(jpegWithMetadata())),
      rateLimitPerMinute: null,
    });
    harness = await startHarness({ questionList: WITH_IMAGES, images });
    const alice = await harness.newPlayer('Alice');
    expect(
      (await harness.api('/api/solo', { token: alice.token, body: { mode: 'CLASSIC' } })).status,
    ).toBe(201);
    await alice.waitFor((state) => state.phase === 'COUNTDOWN');
    harness.clock.advance(3000);
    harness.server.manager.sweep();
    const state = await alice.waitFor((s) => s.phase === 'QUESTION');
    const question = state.question!;
    expect(harness.server.manager.getPublicState(state.roomCode)!.question?.image?.url).toBe(
      question.image!.url,
    );

    await alice.emit('ANSWER', { questionId: question.id, choiceIndex: 0 });
    const revealed = await alice.waitFor((s) => s.phase === 'REVEAL');
    const reveal = revealed.reveal!;
    const record = WITH_IMAGES.find((candidate) => candidate.subject === reveal.subject)!;
    expect(record).toBeTruthy();

    const before = alice.states.filter((s) => s.reveal === null).map((s) => JSON.stringify(s));
    expect(before.length).toBeGreaterThan(0);
    const fileStem = record.subject.replace(/ /g, '_');
    for (const text of before) {
      expect(text).not.toContain('wikimedia');
      expect(text).not.toContain(fileStem);
      expect(text).not.toContain(record.id);
      expect(text).not.toContain('Photographer of');
      expect(text).not.toContain('Author of');
      expect(text).not.toContain('"subject"');
    }
    expect(question.id).not.toBe(record.id);
    expect(question.image).toEqual({
      url: expect.stringMatching(/^\/img\/[A-Za-z0-9_-]{75}$/),
      alt: 'Picture to identify',
      widths: [330, 500, 960],
    });

    expect(reveal.image).toMatchObject({
      url: question.image!.url,
      credit: record.image!.credit,
      sourceUrl: record.image!.sourceUrl,
    });
    expect(reveal.image).not.toHaveProperty('author');

    const picture = await fetch(`${harness.baseUrl}${question.image!.url}?w=330`);
    expect(picture.status).toBe(200);
    expect(picture.headers.get('content-disposition')).toBeNull();
  });
});
