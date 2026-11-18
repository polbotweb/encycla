/**
 * Builds the Encycla brand from code (D-111), so every asset is reproducible:
 *   pnpm run brand
 *
 * - The mark (an open book under a spark of discovery, on a night-blue tile) is plain SVG geometry.
 * - The wordmark is Merriweather ExtraBold / Inter Bold turned into SVG paths with opentype.js, from
 *   the OFL fonts the client already ships (@fontsource), so the SVG needs no font at all.
 * - PNGs (favicons, app icons, maskable icon, social previews) are rendered with resvg; the social
 *   previews' text (French, English, Arabic) is shaped by resvg from the same OFL fonts.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { inflateSync } from 'node:zlib';
import { Resvg, type ResvgRenderOptions } from '@resvg/resvg-js';

type ResvgFont = NonNullable<ResvgRenderOptions['font']> & { fontBuffers?: Buffer[] };
import opentype from 'opentype.js';
import { format, resolveConfig } from 'prettier';

async function formatTs(file: string, source: string): Promise<string> {
  return format(source, { ...(await resolveConfig(file)), filepath: file });
}

const FONTS = 'node_modules/@fontsource';
const COLORS = {
  night: '#0b1220',
  deep: '#1e3a8a',
  ink: '#f8fafc',
  inkDark: '#0f172a',
  sky: '#60a5fa',
  paper: '#f8fafc',
  paperShade: '#bfdbfe',
  spark: '#fbbf24',
  success: '#34d399',
  muted: '#94a3b8',
};

// ------------------------------------------------------------------ fonts

/** WOFF 1.0 → plain sfnt (TrueType/OpenType), the format resvg reads. */
function woffToSfnt(woff: Buffer): Buffer {
  if (woff.readUInt32BE(0) !== 0x774f4646) throw new Error('not a WOFF 1.0 file');
  const flavor = woff.readUInt32BE(4);
  const numTables = woff.readUInt16BE(12);
  const tables: { tag: number; checksum: number; data: Buffer }[] = [];
  for (let index = 0; index < numTables; index += 1) {
    const at = 44 + index * 20;
    const offset = woff.readUInt32BE(at + 4);
    const compLength = woff.readUInt32BE(at + 8);
    const origLength = woff.readUInt32BE(at + 12);
    const raw = woff.subarray(offset, offset + compLength);
    tables.push({
      tag: woff.readUInt32BE(at),
      checksum: woff.readUInt32BE(at + 16),
      data: compLength < origLength ? inflateSync(raw) : Buffer.from(raw),
    });
  }
  let searchRange = 1;
  let entrySelector = 0;
  while (searchRange * 2 <= numTables) {
    searchRange *= 2;
    entrySelector += 1;
  }
  const header = Buffer.alloc(12 + numTables * 16);
  header.writeUInt32BE(flavor, 0);
  header.writeUInt16BE(numTables, 4);
  header.writeUInt16BE(searchRange * 16, 6);
  header.writeUInt16BE(entrySelector, 8);
  header.writeUInt16BE(numTables * 16 - searchRange * 16, 10);
  const bodies: Buffer[] = [];
  let offset = header.length;
  tables.forEach((table, index) => {
    const at = 12 + index * 16;
    header.writeUInt32BE(table.tag, at);
    header.writeUInt32BE(table.checksum, at + 4);
    header.writeUInt32BE(offset, at + 8);
    header.writeUInt32BE(table.data.length, at + 12);
    const padded = Buffer.alloc((table.data.length + 3) & ~3);
    table.data.copy(padded);
    bodies.push(padded);
    offset += padded.length;
  });
  return Buffer.concat([header, ...bodies]);
}

async function font(file: string): Promise<{ sfnt: Buffer; font: opentype.Font }> {
  const sfnt = woffToSfnt(await readFile(`${FONTS}/${file}`));
  const buffer = sfnt.buffer.slice(sfnt.byteOffset, sfnt.byteOffset + sfnt.byteLength);
  return { sfnt, font: opentype.parse(buffer) };
}

// ------------------------------------------------------------------ geometry

const round = (value: number): string => String(Math.round(value * 100) / 100);

/** Text as one SVG path (left-aligned at x, baseline y), with optional letter spacing. */
function textPath(
  face: opentype.Font,
  text: string,
  size: number,
  x = 0,
  y = 0,
  tracking = 0,
): { d: string; width: number } {
  let cursor = x;
  const parts: string[] = [];
  const glyphs = face.stringToGlyphs(text);
  glyphs.forEach((glyph, index) => {
    parts.push(glyph.getPath(cursor, y, size).toPathData(2));
    const next = glyphs[index + 1];
    const kerning = next ? face.getKerningValue(glyph, next) : 0;
    cursor += ((glyph.advanceWidth ?? 0) + kerning) * (size / face.unitsPerEm) + tracking;
  });
  return { d: parts.join(''), width: cursor - x - (glyphs.length > 0 ? tracking : 0) };
}

/** The mark on a 64 × 64 grid: tile, open book, spark. `inset` scales the drawing (maskable). */
function markBody(options: { tile?: 'rounded' | 'full'; scale?: number } = {}): string {
  const scale = options.scale ?? 1;
  const tile =
    options.tile === 'full'
      ? `<rect width="64" height="64" fill="url(#encycla-tile)"/>`
      : `<rect width="64" height="64" rx="15" fill="url(#encycla-tile)"/>` +
        `<rect x="0.75" y="0.75" width="62.5" height="62.5" rx="14.25" fill="none" stroke="${COLORS.sky}" stroke-opacity="0.45" stroke-width="1.5"/>`;
  const drawing =
    // Left and right pages, curving away from the spine.
    `<path d="M30.6 29.2C24.8 25.4 17.4 25 10.5 27v23.4c6.9-2 14.3-1.6 20.1 2.2z" fill="url(#encycla-page)"/>` +
    `<path d="M33.4 29.2c5.8-3.8 13.2-4.2 20.1-2.2v23.4c-6.9-2-14.3-1.6-20.1 2.2z" fill="url(#encycla-page)"/>` +
    // Two lines of text on each page, visible from 32 px up.
    `<path d="M15 33.4c3.6-.7 7.6-.5 11 .8M15 38.4c3.6-.7 7.6-.5 11 .8M38 34.2c3.4-1.3 7.4-1.5 11-.8M38 39.2c3.4-1.3 7.4-1.5 11-.8" fill="none" stroke="${COLORS.deep}" stroke-opacity="0.35" stroke-width="1.6" stroke-linecap="round"/>` +
    // The spark of discovery above the spine.
    `<path d="M32 5.5c.9 5.6 3 7.7 8.6 8.6-5.6.9-7.7 3-8.6 8.6-.9-5.6-3-7.7-8.6-8.6 5.6-.9 7.7-3 8.6-8.6z" fill="${COLORS.spark}"/>`;
  const transform =
    scale === 1
      ? ''
      : ` transform="translate(${round(32 - 32 * scale)} ${round(32 - 32 * scale)}) scale(${scale})"`;
  return `${tile}<g${transform}>${drawing}</g>`;
}

const DEFS =
  `<defs>` +
  `<linearGradient id="encycla-tile" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">` +
  `<stop offset="0" stop-color="${COLORS.deep}"/><stop offset="1" stop-color="${COLORS.night}"/></linearGradient>` +
  `<linearGradient id="encycla-page" x1="0" y1="25" x2="0" y2="53" gradientUnits="userSpaceOnUse">` +
  `<stop offset="0" stop-color="${COLORS.paper}"/><stop offset="1" stop-color="${COLORS.paperShade}"/></linearGradient>` +
  `</defs>`;

function markSvg(size: number | null, options: Parameters<typeof markBody>[0] = {}): string {
  const dims = size === null ? '' : ` width="${size}" height="${size}"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"${dims} role="img" aria-label="Encycla">` +
    `<title>Encycla</title>${DEFS}${markBody(options)}</svg>\n`
  );
}

// ------------------------------------------------------------------ outputs

async function write(path: string, data: string | Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
  console.log(`  ${path}`);
}

function png(source: string, width: number, fonts: Buffer[] = []): Buffer {
  // Size the root from its viewBox so resvg rasterises the vectors at the target width.
  const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(source);
  const svg =
    box && !/^<svg[^>]* width=/.test(source)
      ? source.replace(
          '<svg ',
          `<svg width="${width}" height="${Math.round((width * Number(box[2])) / Number(box[1]))}" `,
        )
      : source;
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    // `fontBuffers` exists at runtime since resvg-js 2.5; the bundled typings predate it.
    font: {
      loadSystemFonts: false,
      fontBuffers: fonts,
      defaultFontFamily: 'Inter',
    } as ResvgFont,
    shapeRendering: 2,
    textRendering: 2,
  })
    .render()
    .asPng();
}

async function main(): Promise<void> {
  const serif = await font('merriweather/files/merriweather-latin-800-normal.woff');
  const sans = await font('inter/files/inter-latin-700-normal.woff');
  const sansRegular = await font('inter/files/inter-latin-400-normal.woff');
  const arabic = await font('noto-sans-arabic/files/noto-sans-arabic-arabic-700-normal.woff');
  const arabicRegular = await font(
    'noto-sans-arabic/files/noto-sans-arabic-arabic-400-normal.woff',
  );
  const fonts = [serif, sans, sansRegular, arabic, arabicRegular].map(({ sfnt }) => sfnt);

  // Wordmark: "Encycla" in Merriweather ExtraBold, "MINDMAZE" in tracked Inter Bold underneath.
  const word = textPath(serif.font, 'Encycla', 40, 0, 40);
  const tag = textPath(sans.font, 'MINDMAZE', 11, 1, 58, 4.2);
  const wordWidth = Math.max(word.width, tag.width);

  console.log('Brand assets:');
  await write('public/favicon.svg', markSvg(null));
  await write('public/brand/encycla-mark.svg', markSvg(null));
  const logo = (text: string, accent: string) => {
    const width = Math.ceil(64 + 16 + wordWidth + 2);
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 64" role="img" aria-label="Encycla MindMaze">` +
      `<title>Encycla MindMaze</title>${DEFS}${markBody()}` +
      `<g transform="translate(80 0)"><path d="${word.d}" fill="${text}"/><path d="${tag.d}" fill="${accent}"/></g></svg>\n`
    );
  };
  const onDark = logo(COLORS.ink, COLORS.sky);
  const onLight = logo(COLORS.inkDark, '#1d4ed8');
  await write('public/brand/encycla-logo.svg', onDark);
  await write('public/brand/encycla-logo-on-light.svg', onLight);
  await write('public/brand/encycla-logo.png', png(onDark, 1200));
  await write('public/brand/encycla-logo-on-light.png', png(onLight, 1200));

  // Favicons and app icons.
  await write('public/favicon-16.png', png(markSvg(16), 16));
  await write('public/favicon-32.png', png(markSvg(32), 32));
  await write('public/apple-touch-icon.png', png(markSvg(180, { tile: 'full' }), 180));
  await write('public/icon-192.png', png(markSvg(192), 192));
  await write('public/icon-512.png', png(markSvg(512), 512));
  // Maskable: full-bleed tile, drawing inside the 80 % safe zone.
  await write(
    'public/icon-maskable-512.png',
    png(markSvg(512, { tile: 'full', scale: 0.78 }), 512),
  );

  // Header component: the same paths, text in currentColor (light and dark backgrounds).
  const pathsFile = 'client/components/ui/brand-paths.ts';
  await write(
    pathsFile,
    await formatTs(
      pathsFile,
      `// Generated by scripts/brand/build-brand.ts (pnpm run brand). Do not edit.\n` +
        `export const WORDMARK_PATH = ${JSON.stringify(word.d)};\n` +
        `export const TAGLINE_PATH = ${JSON.stringify(tag.d)};\n` +
        `export const WORDMARK_WIDTH = ${Math.ceil(wordWidth + 2)};\n`,
    ),
  );

  // Social previews, 1200 × 630.
  const previews = {
    fr: {
      tagline: 'Le jeu de l’encyclopédie visuelle',
      line: 'Identifiez l’image, puis lisez l’article.',
      dir: 'ltr',
    },
    en: {
      tagline: 'The visual encyclopedia game',
      line: 'Identify the picture, then read the article.',
      dir: 'ltr',
    },
    ar: {
      tagline: 'لعبة الموسوعة المصوّرة',
      line: 'تعرّف على الصورة، ثم اقرأ المقالة.',
      dir: 'rtl',
    },
  } as const;
  for (const [language, copy] of Object.entries(previews)) {
    const face = copy.dir === 'rtl' ? arabic.font : sans.font;
    const faceRegular = copy.dir === 'rtl' ? arabicRegular.font : sansRegular.font;
    // Largest sizes (≤ 48 / 30 px) that keep the copy clear of the quiz card.
    const fit = (face: opentype.Font, text: string, max: number) => {
      const width = face.getAdvanceWidth(text, 100) / 100;
      return Math.min(max, Math.floor(COPY_WIDTH / width));
    };
    // opentype.js cannot shape Arabic: the Arabic copy uses sizes checked on the rendered image.
    const sizes =
      copy.dir === 'rtl'
        ? { tagline: 50, line: 32 }
        : { tagline: fit(face, copy.tagline, 48), line: fit(faceRegular, copy.line, 30) };
    await write(
      `public/og/encycla-${language}.png`,
      png(socialSvg(copy, sizes, wordWidth, word.d, tag.d), 1200, fonts),
    );
  }
}

/** Width available to the copy beside the quiz card. */
const COPY_WIDTH = 580;

const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** "Français · English · العربية" as three pills, each name in its own language and script. */
function languageChips(edge: number, y: number, rtl: boolean): string {
  const chips = [
    { text: 'Français', family: 'Inter', width: 128 },
    { text: 'English', family: 'Inter', width: 118 },
    { text: 'العربية', family: 'Noto Sans Arabic', width: 112 },
  ];
  let x = rtl ? edge : edge;
  return chips
    .map((chip) => {
      const left = rtl ? x - chip.width : x;
      x = rtl ? left - 14 : left + chip.width + 14;
      return (
        `<rect x="${left}" y="${y}" width="${chip.width}" height="46" rx="23" fill="${COLORS.sky}" fill-opacity="0.14" stroke="${COLORS.sky}" stroke-opacity="0.6" stroke-width="2"/>` +
        `<text x="${left + chip.width / 2}" y="${y + 31}" text-anchor="middle" font-family="${chip.family}" font-weight="700" font-size="21" fill="${COLORS.ink}">${chip.text}</text>`
      );
    })
    .join('');
}

function socialSvg(
  copy: { tagline: string; line: string; dir: 'ltr' | 'rtl' },
  sizes: { tagline: number; line: number },
  wordWidth: number,
  word: string,
  tag: string,
): string {
  const rtl = copy.dir === 'rtl';
  const family = rtl ? 'Noto Sans Arabic' : 'Inter';
  // Text block on the left (LTR) or right (RTL); the quiz card on the other side.
  const textX = rtl ? 1120 : 80;
  const anchor = rtl ? 'end' : 'start';
  const cardX = rtl ? 80 : 700;
  const cardWidth = 420;
  const scale = 2.3;
  const logoWidth = (80 + wordWidth) * scale;
  const logoX = rtl ? 1120 - logoWidth : 80;
  const option = (index: number, label: string, correct: boolean) => {
    const y = 380 + index * 50;
    return (
      `<rect x="${cardX + 24}" y="${y}" width="372" height="40" rx="10" fill="${correct ? COLORS.success : '#1e293b'}" fill-opacity="${correct ? 0.22 : 1}" stroke="${correct ? COLORS.success : '#334155'}" stroke-width="2"/>` +
      `<rect x="${cardX + 36}" y="${y + 9}" width="22" height="22" rx="6" fill="${correct ? COLORS.success : '#334155'}"/>` +
      `<text x="${cardX + 47}" y="${y + 25}" font-family="Inter" font-weight="700" font-size="14" fill="${correct ? COLORS.inkDark : COLORS.ink}" text-anchor="middle">${label}</text>` +
      `<rect x="${cardX + 72}" y="${y + 16}" width="${[150, 190, 120, 170][index]}" height="8" rx="4" fill="${COLORS.muted}" fill-opacity="${correct ? 0.9 : 0.45}"/>`
    );
  };
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">${DEFS}` +
    `<defs><radialGradient id="glow" cx="${rtl ? 0.2 : 0.8}" cy="0.25" r="0.8">` +
    `<stop offset="0" stop-color="${COLORS.deep}" stop-opacity="0.9"/><stop offset="1" stop-color="${COLORS.night}" stop-opacity="1"/></radialGradient>` +
    `<pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="${COLORS.sky}" fill-opacity="0.18"/></pattern></defs>` +
    `<rect width="1200" height="630" fill="url(#glow)"/><rect width="1200" height="630" fill="url(#dots)"/>` +
    // Logo.
    `<g transform="translate(${round(logoX)} 96) scale(${scale})">${markBody()}<g transform="translate(80 0)"><path d="${word}" fill="${COLORS.ink}"/><path d="${tag}" fill="${COLORS.sky}"/></g></g>` +
    // Copy.
    `<text x="${textX}" y="340" direction="${copy.dir}" text-anchor="${anchor}" font-family="${family}" font-weight="700" font-size="${sizes.tagline}" fill="${COLORS.ink}">${escape(copy.tagline)}</text>` +
    `<text x="${textX}" y="396" direction="${copy.dir}" text-anchor="${anchor}" font-family="${family}" font-weight="400" font-size="${sizes.line}" fill="#cbd5e1">${escape(copy.line)}</text>` +
    languageChips(rtl ? 1120 : 80, 470, rtl) +
    // Quiz card: picture to identify, four options, the right one lit.
    `<g><rect x="${cardX}" y="96" width="${cardWidth}" height="498" rx="22" fill="#0f172a" stroke="#334155" stroke-width="2"/>` +
    `<rect x="${cardX + 24}" y="120" width="372" height="236" rx="14" fill="url(#encycla-tile)"/>` +
    `<circle cx="${cardX + 300}" cy="186" r="34" fill="${COLORS.spark}" fill-opacity="0.9"/>` +
    `<path d="M${cardX + 24} 320 L${cardX + 130} 236 L${cardX + 200} 290 L${cardX + 262} 248 L${cardX + 396} 330 V342 a14 14 0 0 1 -14 14 H${cardX + 38} a14 14 0 0 1 -14 -14 Z" fill="${COLORS.sky}" fill-opacity="0.55"/>` +
    `<circle cx="${cardX + 150}" cy="210" r="46" fill="none" stroke="${COLORS.ink}" stroke-width="8"/>` +
    `<path d="M${cardX + 183} 243 l34 34" stroke="${COLORS.ink}" stroke-width="12" stroke-linecap="round"/>` +
    option(0, 'A', false) +
    option(1, 'B', true) +
    option(2, 'C', false) +
    option(3, 'D', false) +
    `</g></svg>`
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
