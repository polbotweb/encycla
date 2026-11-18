import { expect, test } from '@playwright/test';

interface Snapshot {
  phase: string;
  question: { id: string; image: Record<string, unknown> | null } | null;
  reveal: {
    questionId: string;
    image: { url: string; sourceUrl?: string; credit?: string } | null;
  } | null;
}

/** ROOM_STATE payloads out of raw Socket.io frames (`42/game,["ROOM_STATE",{...}]`). */
function roomStates(frames: string[]): Snapshot[] {
  return frames.flatMap((frame) => {
    const start = frame.indexOf('[');
    if (start < 0) return [];
    try {
      const [type, payload] = JSON.parse(frame.slice(start)) as [string, unknown];
      return type === 'ROOM_STATE' ? [payload as Snapshot] : [];
    } catch {
      return [];
    }
  });
}

/** Distinctive part of a Commons file name (`File:Panthera_leo_(Ngorongoro).jpg` → `Panthera_leo`). */
function fileStem(sourceUrl: string): string {
  const name = decodeURIComponent(sourceUrl.split('File:')[1] ?? '');
  return name.replace(/\.[a-z]+$/i, '').slice(0, 12);
}

test('a question reaches the browser without the Commons file name, credit or answer', async ({
  page,
}) => {
  const frames: string[] = [];
  const requests: string[] = [];
  page.on('websocket', (socket) => {
    socket.on('framereceived', (event) => frames.push(String(event.payload)));
  });
  page.on('request', (request) => requests.push(request.url()));

  await page.goto('/?lang=en');
  await page.getByLabel(/nickname/i).fill('Alice');
  await page.getByRole('button', { name: /solo classic/i }).click();
  await page.getByRole('button', { name: /^start/i }).click();
  await expect(page.locator('#question-title')).toBeVisible({ timeout: 15_000 });

  const questionHtml = await page.content();
  const framesAtQuestion = frames.length;
  const requestsAtQuestion = [...requests];
  const image = page.locator('figure img').first();
  let imageAttributes = '';
  if (await image.count()) {
    const src = (await image.getAttribute('src')) ?? '';
    imageAttributes = [
      src,
      await image.getAttribute('srcset'),
      await image.getAttribute('alt'),
    ].join(' ');
    expect(src).toMatch(/^\/img\/[A-Za-z0-9_-]{75}\?w=\d+$/);
    const response = await page.request.get(src);
    expect(response.headers()['content-disposition']).toBeUndefined();
    expect(response.headers()['cache-control'] ?? '').toMatch(/private|no-store/);
  }

  await page.keyboard.press('KeyB');
  await expect(page.getByText(/Continue/)).toBeVisible({ timeout: 15_000 });

  const before = roomStates(frames.slice(0, framesAtQuestion));
  const question = before.find((state) => state.question)?.question;
  expect(question).toBeTruthy();
  expect(question).not.toHaveProperty('subject');
  if (question?.image) {
    expect(Object.keys(question.image).sort()).toEqual(expect.arrayContaining(['alt', 'url']));
    expect(question.image).not.toHaveProperty('credit');
    expect(question.image).not.toHaveProperty('sourceUrl');
    expect(question.image).not.toHaveProperty('license');
  }

  const reveal = roomStates(frames).find(
    (state) => state.reveal?.questionId === question?.id,
  )?.reveal;
  expect(reveal).toBeTruthy();
  expect(reveal?.image?.url ?? '/img/').toMatch(/^\/img\//);

  const leaked = [
    frames.slice(0, framesAtQuestion).join('\n'),
    questionHtml,
    ...requestsAtQuestion,
  ];
  for (const text of leaked) {
    expect(text).not.toContain('wikimedia');
    expect(text).not.toContain('File:');
  }
  // The options legitimately contain the answer: the file name must not reach the picture itself.
  if (reveal?.image?.sourceUrl && fileStem(reveal.image.sourceUrl).length >= 4) {
    const stem = fileStem(reveal.image.sourceUrl);
    const pictureData = [
      JSON.stringify(question?.image ?? null),
      imageAttributes,
      ...requestsAtQuestion,
    ];
    for (const text of pictureData) {
      expect(text).not.toContain(stem);
      expect(text).not.toContain(encodeURIComponent(stem));
    }
  }
});
