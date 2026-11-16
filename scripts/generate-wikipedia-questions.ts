/**
 * Builds data/questions.json from Wikipedia and Wikimedia Commons.
 *
 * What is curated: only the *list of article titles* (scripts/wikimedia/seeds/*). Everything
 * else is fetched live and nothing is invented:
 *   - answer       = title of the French Wikipedia article (qualifier in parentheses removed);
 *   - explanation  = first sentence of that article, verbatim;
 *   - article body = introduction of that article, verbatim (whole sentences);
 *   - image        = lead image of the article (fallback: Wikidata P18), only when the file lives on
 *                    Wikimedia Commons under CC0 / public domain / CC BY / CC BY-SA;
 *   - author, licence, file page = Commons metadata;
 *   - source       = permalink + revision id of the article.
 *   - distractors  = other real subjects of the same kind, preferably from the same group.
 * Anything doubtful is dropped (and listed in data/sources/report.json).
 *
 * Usage: pnpm data:wikipedia [-- --offline] [-- --refresh] [-- --lang=fr] [-- --cap=150]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { validateQuestionBank } from '../shared/question-bank';
import {
  CATEGORY_VALUES,
  MIN_QUESTIONS_PER_CATEGORY,
  TRANSLATED_LANGUAGES,
  type QuestionCategory,
  type QuestionRecord,
  type QuestionSource,
  type QuestionTranslation,
  type TranslatedLanguage,
  type TranslationOrigin,
} from '../shared/schemas';
import { chunk, WikiClient } from './wikimedia/client';
import { pickDistractors, seededRandom, shuffle, type Candidate } from './wikimedia/distractors';
import {
  classifyLicense,
  extractAuthor,
  isNonPhotoFilename,
  type CommonsExtMetadata,
} from './wikimedia/licenses';
import {
  ALT_TEXT,
  creditLine,
  PHRASES,
  QUESTION_TEXT,
  translatedLabel,
} from './wikimedia/languages';
import { SEEDS } from './wikimedia/seeds';
import {
  buildArticleBody,
  cleanExtract,
  firstSentence,
  labelAppearsIn,
  labelFromTitle,
  normalizeText,
  slugify,
} from './wikimedia/text';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
const LANG = flag('lang') ?? 'fr';
const CAP = Number(flag('cap') ?? '150');
const OFFLINE = args.includes('--offline');
const REFRESH = args.includes('--refresh');
const OUTPUT = flag('out') ?? 'data/questions.json';
const REPORT = 'data/sources/report.json';
const CREDITS = 'CREDITS.md';

const AMBIGUOUS_OPENING = /\bpeut(?:vent)? (?:aussi )?désigner\b/i;
const PLACE_OPENING =
  /\b(?:est|sont) (?:une |un |des )?(?:ancienne |ancien )?(?:commune|ville|village|hameau|localité|municipalité|cours d'eau|rivière|fleuve|sommet|massif|montagne|île|canton|région)\b/i;
const FUNGUS_OPENING =
  /champignon|fongi|fungi|basidiomycète|ascomycète|bolet|amanit|morille|russule|lactaire|truffe|polypore|agaric|cortinaire|mycolog|coprin|lépiote|tricholome/i;
/** Categories whose subjects are legitimately places or sites. */
const PLACE_CATEGORIES = new Set<string>(['Geography', 'Architecture', 'History']);

const WIKI_API = `https://${LANG}.wikipedia.org/w/api.php`;
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
// Commons only serves thumbnails in a fixed set of standard widths (640 is rejected with HTTP 400).
const THUMB_WIDTH = 960;
const MIN_WIDTH = 400;
const MIN_ARTICLE_CHARS = 200;
const MAX_ARTICLE_CHARS = 1200;

const client = new WikiClient({
  cacheDir: 'data/cache/wikimedia',
  offline: OFFLINE,
  refresh: REFRESH,
});

// ---------------------------------------------------------------- types

interface WikiPage {
  title: string;
  pageid?: number;
  missing?: boolean;
  extract?: string;
  pageimage?: string;
  lastrevid?: number;
  pageprops?: { wikibase_item?: string; disambiguation?: string };
}

interface WikiQueryBody {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string; tofragment?: string }[];
    pages?: WikiPage[];
  };
}

interface CommonsPage {
  title: string;
  missing?: boolean;
  imageinfo?: {
    url: string;
    thumburl?: string;
    descriptionurl: string;
    width: number;
    height: number;
    mime: string;
    extmetadata?: CommonsExtMetadata;
  }[];
}

interface CommonsBody {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: CommonsPage[];
  };
}

interface Subject {
  category: QuestionCategory;
  group: string;
  question: string;
  alt: string;
  kind: 'title' | 'flag';
  seedTitle: string;
  title: string;
  pageId: number;
  qid: string | undefined;
  revisionId: number;
  extract: string;
  fetchedAt: string;
  pageImage: string | undefined;
}

interface ImageChoice {
  file: string;
  url: string;
  descriptionUrl: string;
  author: string;
  license: string;
  family: string;
}

interface Drop {
  category: string;
  title: string;
  reason: string;
}

const drops: Drop[] = [];
const redirects: { category: string; seed: string; article: string }[] = [];
const drop = (category: string, title: string, reason: string): void => {
  drops.push({ category, title, reason });
};

// ---------------------------------------------------------------- wikipedia

async function resolveArticles(
  titles: string[],
  endpoint = WIKI_API,
): Promise<Map<string, WikiPage & { fetchedAt: string }>> {
  const out = new Map<string, WikiPage & { fetchedAt: string }>();

  for (const batch of chunk(titles, 20)) {
    const { body, fetchedAt } = await client.get<WikiQueryBody>(endpoint, {
      action: 'query',
      titles: batch.join('|'),
      redirects: '1',
      prop: 'extracts|pageimages|pageprops|info',
      exintro: '1',
      explaintext: '1',
      exlimit: 'max',
      piprop: 'name',
      ppprop: 'wikibase_item|disambiguation',
    });

    const normalized = new Map((body.query?.normalized ?? []).map((n) => [n.from, n.to]));
    const redirects = new Map((body.query?.redirects ?? []).map((r) => [r.from, r]));
    const pages = new Map((body.query?.pages ?? []).map((page) => [page.title, page]));

    for (const seed of batch) {
      const normal = normalized.get(seed) ?? seed;
      const redirect = redirects.get(normal);
      if (redirect?.tofragment) {
        out.set(seed, { title: redirect.to, missing: true, fetchedAt });
        continue;
      }
      const page = pages.get(redirect?.to ?? normal);
      out.set(seed, page ? { ...page, fetchedAt } : { title: seed, missing: true, fetchedAt });
    }
  }
  return out;
}

async function fetchLongExtract(title: string, endpoint = WIKI_API): Promise<string> {
  const { body } = await client.get<WikiQueryBody>(endpoint, {
    action: 'query',
    titles: title,
    redirects: '1',
    prop: 'extracts',
    explaintext: '1',
    exchars: '2500',
  });
  return body.query?.pages?.[0]?.extract ?? '';
}

async function fetchWikidataImages(qids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const batch of chunk(qids, 50)) {
    const { body } = await client.get<{
      entities?: Record<
        string,
        { claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] } }
      >;
    }>(WIKIDATA_API, { action: 'wbgetentities', ids: batch.join('|'), props: 'claims' });

    for (const [qid, entity] of Object.entries(body.entities ?? {})) {
      const file = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (file) {
        out.set(qid, file);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- commons

type CommonsFile = NonNullable<CommonsPage['imageinfo']>[number];

async function fetchCommons(files: string[]): Promise<Map<string, CommonsFile | null>> {
  const out = new Map<string, CommonsFile | null>();
  const unique = [...new Set(files)];

  for (const batch of chunk(unique, 50)) {
    const titles = batch.map((file) => `File:${file.replace(/^File:/i, '')}`);
    const { body } = await client.get<CommonsBody>(COMMONS_API, {
      action: 'query',
      titles: titles.join('|'),
      redirects: '1',
      prop: 'imageinfo',
      iiprop: 'extmetadata|url|mime|size',
      iiurlwidth: String(THUMB_WIDTH),
      iiextmetadatafilter: 'LicenseShortName|UsageTerms|Artist|Credit|Copyrighted|NonFree',
    });

    const normalized = new Map((body.query?.normalized ?? []).map((n) => [n.from, n.to]));
    const redirects = new Map((body.query?.redirects ?? []).map((r) => [r.from, r.to]));
    const pages = new Map((body.query?.pages ?? []).map((page) => [page.title, page]));

    batch.forEach((file, index) => {
      const requested = titles[index] as string;
      const normal = normalized.get(requested) ?? requested;
      const page = pages.get(redirects.get(normal) ?? normal);
      out.set(file, page && !page.missing ? (page.imageinfo?.[0] ?? null) : null);
    });
  }
  return out;
}

/** upload.wikimedia.org URL without tracking parameters (the API answers with thumb.wikimedia.org). */
function canonicalImageUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (!['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname)) {
      return null;
    }
    url.hostname = 'upload.wikimedia.org';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function evaluateImage(
  file: string,
  info: CommonsFile | null | undefined,
  allowSvg: boolean,
): { image?: ImageChoice; reason?: string } {
  if (!info) {
    return { reason: 'image not on Wikimedia Commons' };
  }
  if (isNonPhotoFilename(file, allowSvg)) {
    return { reason: 'image is not a photograph of the subject (map/diagram/logo/…)' };
  }
  const isSvg = info.mime === 'image/svg+xml';
  if (!(allowSvg && isSvg) && !['image/jpeg', 'image/png'].includes(info.mime)) {
    return { reason: `unsupported image type ${info.mime}` };
  }
  if (!allowSvg) {
    const ratio = info.width / info.height;
    if (info.width < MIN_WIDTH || ratio > 2.6 || ratio < 0.4) {
      return { reason: 'image too small or extreme aspect ratio' };
    }
  }

  const verdict = classifyLicense(info.extmetadata);
  if (!verdict.ok || !verdict.family) {
    return { reason: `licence rejected: ${verdict.reason ?? verdict.license}` };
  }
  const author = extractAuthor(info.extmetadata);
  if (author.unknown && verdict.family !== 'PD' && verdict.family !== 'CC0') {
    return { reason: 'author unknown for an attribution licence' };
  }

  const url = canonicalImageUrl(info.thumburl ?? info.url);
  if (!url) {
    return { reason: 'unexpected image host' };
  }
  return {
    image: {
      file,
      url,
      descriptionUrl: info.descriptionurl,
      author: author.author,
      license: verdict.license,
      family: verdict.family,
    },
  };
}

// ---------------------------------------------------------------- translations

interface WikidataEntity {
  labels: Partial<Record<'fr' | TranslatedLanguage, string | undefined>>;
  sitelinks: Partial<Record<TranslatedLanguage, string | undefined>>;
}

/** Labels (fr/en/ar) and sitelinks (enwiki/arwiki) of Wikidata items, 50 per request. */
async function fetchWikidataEntities(qids: string[]): Promise<Map<string, WikidataEntity>> {
  const out = new Map<string, WikidataEntity>();
  for (const batch of chunk([...new Set(qids)], 50)) {
    const { body } = await client.get<{
      entities?: Record<
        string,
        {
          labels?: Record<string, { value?: string }>;
          sitelinks?: Record<string, { title?: string }>;
        }
      >;
    }>(WIKIDATA_API, {
      action: 'wbgetentities',
      ids: batch.join('|'),
      props: 'labels|sitelinks',
      languages: 'fr|en|ar',
      sitefilter: 'enwiki|arwiki',
    });
    for (const [qid, entity] of Object.entries(body.entities ?? {})) {
      out.set(qid, {
        labels: {
          fr: entity.labels?.fr?.value,
          en: entity.labels?.en?.value,
          ar: entity.labels?.ar?.value,
        },
        sitelinks: {
          en: entity.sitelinks?.enwiki?.title,
          ar: entity.sitelinks?.arwiki?.title,
        },
      });
    }
  }
  return out;
}

interface LangContent {
  /** Answer label in this language. */
  label: string;
  /** Article title including its qualifier, used to tell apart two identical labels. */
  fullTitle: string | undefined;
  origin: TranslationOrigin;
  articleTitle: string;
  body: string;
  /** Raw extract the explanation sentence is taken from (the French one on fallback). */
  extract: string;
  source: QuestionSource;
  article: 'wikipedia' | 'fallback-fr';
}

type SubjectTranslations = Record<TranslatedLanguage, LangContent>;

const MAX_LABEL = 80;

function permalink(language: string, title: string, revisionId: number): string {
  return `https://${language}.wikipedia.org/w/index.php?title=${encodeURIComponent(title.replace(/ /g, '_'))}&oldid=${revisionId}`;
}

const ARTICLE_LICENSE = 'CC BY-SA 4.0';

/**
 * English and Arabic content for the selected subjects, from the *same Wikidata items*:
 *   label   = title of the Wikipedia article in that language (via the Wikidata sitelink),
 *             else the Wikidata label in that language, else the French label (flagged);
 *   article = the article in that language, else the French article (flagged, French revision).
 */
async function fetchTranslations(
  subjects: (Subject & { label: string; body: string })[],
): Promise<Map<Subject, SubjectTranslations>> {
  const entities = await fetchWikidataEntities(
    subjects.flatMap((subject) => (subject.qid ? [subject.qid] : [])),
  );
  const out = new Map<Subject, SubjectTranslations>();
  const articles = {} as Record<TranslatedLanguage, Map<string, WikiPage & { fetchedAt: string }>>;

  for (const language of TRANSLATED_LANGUAGES) {
    const endpoint = `https://${language}.wikipedia.org/w/api.php`;
    const titles = subjects.flatMap((subject) => {
      const title = subject.qid ? entities.get(subject.qid)?.sitelinks[language] : undefined;
      return title ? [title] : [];
    });
    console.log(`Resolving ${titles.length} ${language}.wikipedia.org articles…`);
    const pages = await resolveArticles([...new Set(titles)], endpoint);
    for (const page of pages.values()) {
      if (
        !page.missing &&
        page.extract !== undefined &&
        cleanExtract(page.extract, language).length < MIN_ARTICLE_CHARS
      ) {
        page.extract = await fetchLongExtract(page.title, endpoint);
      }
    }
    articles[language] = pages;
  }

  for (const subject of subjects) {
    const entity = subject.qid ? entities.get(subject.qid) : undefined;
    const kind = subject.kind;
    const frSource: QuestionSource = {
      url: permalink(LANG, subject.title, subject.revisionId),
      revisionId: subject.revisionId,
      language: LANG,
      license: ARTICLE_LICENSE,
      retrievedAt: subject.fetchedAt,
    };
    const result = {} as SubjectTranslations;

    for (const language of TRANSLATED_LANGUAGES) {
      const siteTitle = entity?.sitelinks[language];
      const page = siteTitle ? articles[language].get(siteTitle) : undefined;
      const usable =
        page !== undefined &&
        !page.missing &&
        page.pageprops?.disambiguation === undefined &&
        page.lastrevid !== undefined &&
        page.extract !== undefined;
      const body = usable
        ? buildArticleBody(page.extract as string, MAX_ARTICLE_CHARS, language)
        : '';
      const hasText = usable && body.length >= MIN_ARTICLE_CHARS;

      const candidates: { label: string; origin: TranslationOrigin; full?: string }[] = [];
      if (usable) {
        candidates.push({
          label: translatedLabel(page.title, kind, language),
          origin: 'wikipedia',
          full: page.title,
        });
      }
      const wikidataLabel = entity?.labels[language];
      if (wikidataLabel) {
        candidates.push({
          label: translatedLabel(wikidataLabel, kind, language),
          origin: 'wikidata',
        });
      }
      const chosen = candidates.find(
        (candidate) => candidate.label.length > 0 && candidate.label.length <= MAX_LABEL,
      ) ?? { label: subject.label, origin: 'fallback-fr' as const };

      if (hasText) {
        result[language] = {
          label: chosen.label,
          fullTitle: chosen.full,
          origin: chosen.origin,
          articleTitle: page.title,
          body,
          extract: page.extract as string,
          source: {
            url: permalink(language, page.title, page.lastrevid as number),
            revisionId: page.lastrevid as number,
            language,
            license: ARTICLE_LICENSE,
            retrievedAt: page.fetchedAt,
          },
          article: 'wikipedia',
        };
      } else {
        result[language] = {
          label: chosen.label,
          fullTitle: chosen.full,
          origin: chosen.origin,
          articleTitle: chosen.origin === 'fallback-fr' ? subject.seedTitle : chosen.label,
          body: subject.body,
          extract: subject.extract,
          source: frSource,
          article: 'fallback-fr',
        };
      }
    }
    out.set(subject, result);
  }
  return out;
}

const normalizeOption = (value: string): string =>
  value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Option labels of a question in one language, consistent with the answer: the label of the same
 * item as in French. Two identical labels are told apart with the full article title (e.g.
 * "Mercury (planet)"), and as a last resort by the French label.
 */
function localizedOptions(
  options: { label: string; translations: SubjectTranslations }[],
  language: TranslatedLanguage,
): { labels: string[]; origins: TranslationOrigin[] } {
  const labels = options.map((option) => option.translations[language].label);
  const origins = options.map((option) => option.translations[language].origin);
  const duplicated = (): Set<number> => {
    const seen = new Map<string, number[]>();
    labels.forEach((label, index) => {
      const key = normalizeOption(label);
      seen.set(key, [...(seen.get(key) ?? []), index]);
    });
    return new Set([...seen.values()].filter((list) => list.length > 1).flat());
  };

  for (const index of duplicated()) {
    const full = options[index]?.translations[language].fullTitle;
    if (full && full !== labels[index] && full.length <= MAX_LABEL) {
      labels[index] = full;
    }
  }
  for (const index of duplicated()) {
    labels[index] = options[index]?.label as string;
    origins[index] = 'fallback-fr';
  }
  return { labels, origins };
}

// ---------------------------------------------------------------- main

async function main(): Promise<void> {
  const seedEntries = CATEGORY_VALUES.flatMap((category) =>
    SEEDS[category].flatMap((group) => group.titles.map((title) => ({ category, group, title }))),
  );
  const allTitles = [...new Set(seedEntries.map((entry) => entry.title))];
  console.log(`Resolving ${allTitles.length} seed titles on ${LANG}.wikipedia.org…`);
  const pages = await resolveArticles(allTitles);

  // 1. Articles: exist, not a disambiguation page, not a duplicate entity.
  const seenPages = new Set<number>();
  const seenQids = new Set<string>();
  const subjects: Subject[] = [];

  for (const { category, group, title } of seedEntries) {
    const page = pages.get(title);
    if (!page || page.missing || page.pageid === undefined) {
      drop(category, title, 'article not found');
      continue;
    }
    if (page.pageprops?.disambiguation !== undefined) {
      drop(category, title, 'disambiguation page');
      continue;
    }
    if (seenPages.has(page.pageid)) {
      drop(category, title, `duplicate of an earlier subject (${page.title})`);
      continue;
    }
    const qid = page.pageprops?.wikibase_item;
    if (qid && seenQids.has(qid)) {
      drop(category, title, `same Wikidata item as an earlier subject (${qid})`);
      continue;
    }
    if (!page.extract || !page.lastrevid) {
      drop(category, title, 'no extract');
      continue;
    }
    seenPages.add(page.pageid);
    if (qid) {
      seenQids.add(qid);
    }
    subjects.push({
      category,
      group: group.group,
      question: group.question,
      alt: group.alt,
      kind: group.label ?? 'title',
      seedTitle: title,
      title: page.title,
      pageId: page.pageid,
      qid,
      revisionId: page.lastrevid,
      extract: page.extract,
      fetchedAt: page.fetchedAt,
      pageImage: page.pageimage,
    });
  }
  console.log(`${subjects.length} distinct articles`);

  // 2. Short introductions: fall back to the beginning of the full article.
  for (const subject of subjects) {
    if (cleanExtract(subject.extract).length < MIN_ARTICLE_CHARS) {
      subject.extract = await fetchLongExtract(subject.title);
    }
  }

  // 3. Images: lead image first, Wikidata P18 as a fallback.
  const firstPass = await fetchCommons(
    subjects.flatMap((subject) => (subject.pageImage ? [subject.pageImage] : [])),
  );
  const chosen = new Map<Subject, ImageChoice>();
  const failures = new Map<Subject, string>();
  for (const subject of subjects) {
    const allowSvg = subject.kind === 'flag';
    const file = subject.pageImage;
    const result = file
      ? evaluateImage(file, firstPass.get(file), allowSvg)
      : { reason: 'article has no lead image' };
    if (result.image) {
      chosen.set(subject, result.image);
    } else {
      failures.set(subject, result.reason ?? 'no image');
    }
  }

  const needFallback = subjects.filter((subject) => !chosen.has(subject) && subject.qid);
  const p18 = await fetchWikidataImages(needFallback.map((subject) => subject.qid as string));
  const fallbackFiles = needFallback.flatMap((subject) => {
    const file = p18.get(subject.qid as string);
    return file && file !== subject.pageImage ? [file] : [];
  });
  const secondPass = await fetchCommons(fallbackFiles);
  for (const subject of needFallback) {
    const file = p18.get(subject.qid as string);
    if (!file || file === subject.pageImage) {
      continue;
    }
    const result = evaluateImage(file, secondPass.get(file), subject.kind === 'flag');
    if (result.image) {
      chosen.set(subject, result.image);
      failures.delete(subject);
    }
  }

  // 4. Quality gates, subject labels, one image per subject.
  const usedFiles = new Set<string>();
  const usedSubjects = new Set<string>();
  const accepted: (Subject & { label: string; image: ImageChoice; body: string })[] = [];

  for (const subject of subjects) {
    const image = chosen.get(subject);
    if (!image) {
      drop(subject.category, subject.seedTitle, failures.get(subject) ?? 'no usable image');
      continue;
    }
    const cleaned = cleanExtract(subject.extract);
    const body = buildArticleBody(subject.extract, MAX_ARTICLE_CHARS);
    if (body.length < MIN_ARTICLE_CHARS) {
      drop(subject.category, subject.seedTitle, `article text too short (${body.length} chars)`);
      continue;
    }
    // The answer is the French name the seed list asks for (a redirect such as "Loup gris" →
    // "Canis lupus" keeps the common name); it must be verifiable in the article it redirects to.
    const redirected = subject.seedTitle !== subject.title;
    let label = labelFromTitle(subject.seedTitle, subject.kind);
    if (usedSubjects.has(normalizeText(label))) {
      label = subject.kind === 'flag' ? label : subject.seedTitle;
    }
    if (usedSubjects.has(normalizeText(label)) || label.length > 80) {
      drop(subject.category, subject.seedTitle, `label "${label}" already used or too long`);
      continue;
    }
    const verifiableLabel = labelFromTitle(subject.seedTitle, 'title');
    const intro = cleaned.slice(0, 700);
    const verified = redirected
      ? labelAppearsIn(verifiableLabel, firstSentence(subject.extract, 700) || intro.slice(0, 300))
      : labelAppearsIn(verifiableLabel, `${subject.title} ${intro}`);
    if (!verified) {
      drop(subject.category, subject.seedTitle, 'answer not found in the article introduction');
      continue;
    }
    if (redirected) {
      redirects.push({
        category: subject.category,
        seed: subject.seedTitle,
        article: subject.title,
      });
    }
    // Wrong kind of article (a village instead of a cheese, a river instead of a goddess…).
    const opening = firstSentence(subject.extract, 400) || cleaned.slice(0, 300);
    if (AMBIGUOUS_OPENING.test(opening)) {
      drop(subject.category, subject.seedTitle, 'article is a homonymy/list-like page');
      continue;
    }
    if (!PLACE_CATEGORIES.has(subject.category) && PLACE_OPENING.test(opening)) {
      drop(
        subject.category,
        subject.seedTitle,
        'article is about a place, not this kind of subject',
      );
      continue;
    }
    if (subject.category === 'Mushrooms' && !FUNGUS_OPENING.test(cleaned.slice(0, 600))) {
      drop(subject.category, subject.seedTitle, 'article does not look like a fungus');
      continue;
    }
    if (usedFiles.has(image.file)) {
      drop(subject.category, subject.seedTitle, 'same image already used by another subject');
      continue;
    }
    usedFiles.add(image.file);
    usedSubjects.add(normalizeText(label));
    accepted.push({ ...subject, label, image, body });
  }

  // 5. Cap per category, round-robin over groups so the cap keeps the variety.
  const selected: typeof accepted = [];
  for (const category of CATEGORY_VALUES) {
    const inCategory = accepted.filter((subject) => subject.category === category);
    const groups = [...new Set(inCategory.map((subject) => subject.group))].map((name) =>
      inCategory.filter((subject) => subject.group === name),
    );
    let taken = 0;
    for (let round = 0; taken < CAP; round += 1) {
      let any = false;
      for (const group of groups) {
        const next = group[round];
        if (next && taken < CAP) {
          selected.push(next);
          taken += 1;
          any = true;
        }
      }
      if (!any) {
        break;
      }
    }
    for (const leftover of inCategory.slice(CAP)) {
      void leftover;
    }
  }

  // 5b. English and Arabic content of the same items (Wikidata sitelinks and labels).
  const translations = await fetchTranslations(selected);

  // 6. Questions.
  const candidates: (Candidate & { subject: (typeof selected)[number] })[] = selected.map(
    (subject) => ({
      id: `${slugify(subject.category)}-${slugify(subject.label)}`,
      category: subject.category,
      group: subject.group,
      question: subject.question,
      label: subject.label,
      pageId: subject.pageId,
      qid: subject.qid,
      complete: TRANSLATED_LANGUAGES.every(
        (language) =>
          (translations.get(subject) as SubjectTranslations)[language].origin !== 'fallback-fr',
      ),
      subject,
    }),
  );
  const ids = new Set<string>();
  for (const candidate of candidates) {
    let id = candidate.id;
    for (let n = 2; ids.has(id); n += 1) {
      id = `${candidate.id}-${n}`;
    }
    ids.add(id);
    candidate.id = id;
  }

  const questions: QuestionRecord[] = [];
  for (const candidate of candidates) {
    const { subject } = candidate;
    const random = seededRandom(candidate.id);
    const distractors = pickDistractors(candidate, candidates, random);
    if (!distractors) {
      drop(subject.category, subject.seedTitle, 'not enough distractors of the same kind');
      continue;
    }

    const options = shuffle([candidate, ...distractors] as (typeof candidates)[number][], random);
    const correctIndex = options.findIndex((option) => option.id === candidate.id);
    const sentence = firstSentence(subject.extract, 430);
    const explanation = sentence
      ? `${PHRASES.correctAnswer.fr} : ${subject.label}. ${sentence}`
      : `${PHRASES.correctAnswer.fr} : ${subject.label}. ${PHRASES.sourceFallback.fr}`;

    const optionItems = options.map((option) => ({
      label: option.label,
      translations: translations.get(option.subject) as SubjectTranslations,
    }));
    const own = translations.get(subject) as SubjectTranslations;
    const translated: Partial<Record<TranslatedLanguage, QuestionTranslation>> = {};
    for (const language of TRANSLATED_LANGUAGES) {
      const content = own[language];
      const { labels, origins } = localizedOptions(optionItems, language);
      const answer = labels[correctIndex] as string;
      const prefix = `${PHRASES.correctAnswer[language]}: ${answer}. `;
      const limit = Math.min(430, 495 - prefix.length);
      const localizedSentence = firstSentence(
        content.extract,
        limit,
        content.article === 'wikipedia' ? language : 'fr',
      );
      const questionText = QUESTION_TEXT[subject.question]?.[language];
      const alt = ALT_TEXT[subject.alt]?.[language];
      if (!questionText || !alt) {
        throw new Error(`Missing ${language} wording for "${subject.question}" / "${subject.alt}"`);
      }
      translated[language] = {
        subject: answer,
        questionText,
        options: labels,
        explanation: `${prefix}${localizedSentence || PHRASES.sourceFallback[language]}`,
        articleTitle: content.articleTitle,
        articleBody: content.body,
        imageAlt: alt,
        imageCredit: creditLine(subject.image.author, language),
        source: content.source,
        provenance: {
          label: origins[correctIndex] as TranslationOrigin,
          options: origins,
          article: content.article,
        },
      };
    }

    questions.push({
      id: candidate.id,
      category: subject.category,
      subject: subject.label,
      questionText: subject.question,
      options: options.map((option) => option.label),
      correctIndex,
      explanation,
      articleTitle: subject.seedTitle,
      articleBody: subject.body,
      image: {
        url: subject.image.url,
        alt: subject.alt,
        credit: creditLine(subject.image.author, 'fr'),
        license: subject.image.license,
        sourceUrl: subject.image.descriptionUrl,
        author: subject.image.author,
      },
      source: {
        url: permalink(LANG, subject.title, subject.revisionId),
        revisionId: subject.revisionId,
        language: LANG,
        license: ARTICLE_LICENSE,
        retrievedAt: subject.fetchedAt,
      },
      translations: translated,
    });
  }

  // 7. Validate with the very schema the server uses, then write everything.
  const generatedAt = questions
    .map((question) => question.source?.retrievedAt ?? '')
    .reduce((latest, value) => (value > latest ? value : latest), '');
  const bank = { version: 1 as const, generatedAt, questions };
  const validation = validateQuestionBank(bank);
  if (!validation.success) {
    for (const error of validation.report.errors.slice(0, 30)) {
      console.error(`ERROR ${error}`);
    }
    throw new Error(`Generated bank is invalid (${validation.report.errors.length} errors)`);
  }

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, await formatJson(bank, OUTPUT), 'utf8');
  await writeReport(questions, seedEntries.length);
  await writeCredits(questions);

  console.log(`\n${questions.length} questions written to ${OUTPUT}`);
  for (const category of CATEGORY_VALUES) {
    const count = validation.report.counts[category];
    const flagMark = count >= MIN_QUESTIONS_PER_CATEGORY ? '' : '  <-- below target';
    console.log(`  ${category}: ${count}${flagMark}`);
  }
  console.log(`API requests: ${client.requests}, cache hits: ${client.cacheHits}`);
}

// ---------------------------------------------------------------- outputs

/** JSON formatted with the repository's Prettier settings, so `pnpm format:check` stays green. */
async function formatJson(value: unknown, file: string): Promise<string> {
  const options = (await resolveConfig(file)) ?? {};
  return format(JSON.stringify(value), { ...options, parser: 'json' });
}

async function writeReport(questions: QuestionRecord[], seedCount: number): Promise<void> {
  const perCategory = Object.fromEntries(
    CATEGORY_VALUES.map((category) => {
      const own = questions.filter((question) => question.category === category);
      const seeds = SEEDS[category].reduce((sum, group) => sum + group.titles.length, 0);
      return [
        category,
        {
          seedTitles: seeds,
          questions: own.length,
          dropped: drops.filter((entry) => entry.category === category).length,
        },
      ];
    }),
  );
  const licenses: Record<string, number> = {};
  for (const question of questions) {
    const license = question.image?.license ?? 'none';
    licenses[license] = (licenses[license] ?? 0) + 1;
  }
  const reasons: Record<string, number> = {};
  for (const entry of drops) {
    const key = entry.reason.replace(/\(.*\)|".*"/g, '').trim();
    reasons[key] = (reasons[key] ?? 0) + 1;
  }

  const report = {
    language: LANG,
    languages: ['fr', ...TRANSLATED_LANGUAGES],
    seedTitles: seedCount,
    questions: questions.length,
    perCategory,
    translations: translationReport(questions),
    imageLicenses: licenses,
    dropReasons: reasons,
    redirects,
    dropped: drops,
  };
  await mkdir(dirname(REPORT), { recursive: true });
  await writeFile(REPORT, await formatJson(report, REPORT), 'utf8');
}

type Origin = 'wikipedia' | 'wikidata' | 'fallback-fr';

interface OriginCounts {
  wikipedia: number;
  wikidata: number;
  'fallback-fr': number;
}

const blankOrigins = (): OriginCounts => ({ wikipedia: 0, wikidata: 0, 'fallback-fr': 0 });

/**
 * Per language and per category: where every answer label, every distractor label and every
 * article of the translations comes from, plus the list of questions that fall back to French.
 */
function translationReport(questions: QuestionRecord[]): Record<string, unknown> {
  const report: Record<string, unknown> = {};
  for (const language of TRANSLATED_LANGUAGES) {
    const labels = blankOrigins();
    const options = blankOrigins();
    const articles = { wikipedia: 0, 'fallback-fr': 0 };
    const categories: Record<
      string,
      { questions: number; labels: OriginCounts; options: OriginCounts; articles: typeof articles }
    > = {};
    const fallbacks: Array<{
      id: string;
      subject: string;
      label: Origin;
      article: string;
      optionFallbacks: number;
    }> = [];

    for (const question of questions) {
      const translation = question.translations?.[language];
      if (!translation) {
        continue;
      }
      const entry = (categories[question.category] ??= {
        questions: 0,
        labels: blankOrigins(),
        options: blankOrigins(),
        articles: { wikipedia: 0, 'fallback-fr': 0 },
      });
      const provenance = translation.provenance;
      entry.questions += 1;
      labels[provenance.label] += 1;
      entry.labels[provenance.label] += 1;
      articles[provenance.article] += 1;
      entry.articles[provenance.article] += 1;
      let optionFallbacks = 0;
      for (const origin of provenance.options) {
        options[origin] += 1;
        entry.options[origin] += 1;
        if (origin === 'fallback-fr') {
          optionFallbacks += 1;
        }
      }
      if (
        provenance.label === 'fallback-fr' ||
        provenance.article === 'fallback-fr' ||
        optionFallbacks > 0
      ) {
        fallbacks.push({
          id: question.id,
          subject: question.subject,
          label: provenance.label,
          article: provenance.article,
          optionFallbacks,
        });
      }
    }
    report[language] = {
      answerLabels: labels,
      optionLabels: options,
      articles,
      perCategory: categories,
      questionsWithAnyFallback: fallbacks.length,
      fallbacks,
    };
  }
  return report;
}

const BEGIN = '<!-- BEGIN GENERATED: wikimedia-credits -->';
const END = '<!-- END GENERATED: wikimedia-credits -->';

async function writeCredits(questions: QuestionRecord[]): Promise<void> {
  const escape = (value: string): string => value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const lines: string[] = [
    BEGIN,
    '',
    '## Contenu des questions (Wikipédia et Wikimedia Commons)',
    '',
    `Les textes (réponses, explications, articles) proviennent de Wikipédia (${LANG}, et ${TRANSLATED_LANGUAGES.join(', ')} pour les traductions), disponibles sous licence [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.fr). Chaque question conserve le permalien de la révision de l’article utilisée, pour chaque langue (champ \`source\` de \`data/questions.json\` et \`translations.<langue>.source\`). Les libellés sans article dans une langue viennent de Wikidata ([CC0](https://creativecommons.org/publicdomain/zero/1.0/deed.fr)) ; l’origine de chaque libellé est enregistrée dans \`translations.<langue>.provenance\`.`,
    '',
    'Les images proviennent de Wikimedia Commons ; auteur, licence et page du fichier sont listés ci-dessous (généré par `pnpm data:wikipedia`, ne pas éditer à la main).',
    '',
  ];
  for (const category of CATEGORY_VALUES) {
    const own = questions.filter((question) => question.category === category);
    if (own.length === 0) {
      continue;
    }
    lines.push(
      `### ${category}`,
      '',
      `| Sujet | Auteur | Licence | Fichier | ${['fr', ...TRANSLATED_LANGUAGES].join(' | ')} |`,
      `| --- | --- | --- | --- | ${['fr', ...TRANSLATED_LANGUAGES].map(() => '---').join(' | ')} |`,
    );
    for (const question of own) {
      const image = question.image;
      const source = question.source;
      if (!image || !source) {
        continue;
      }
      const links = TRANSLATED_LANGUAGES.map((language) => {
        const translation = question.translations?.[language];
        return translation?.provenance.article === 'wikipedia'
          ? `[${language}](${translation.source.url})`
          : '—';
      });
      lines.push(
        `| ${escape(question.subject)} | ${escape(image.author ?? image.credit)} | ${escape(image.license)} | [Commons](${image.sourceUrl}) | [${LANG}](${source.url}) | ${links.join(' | ')} |`,
      );
    }
    lines.push('');
  }
  lines.push(END);

  let existing = '';
  try {
    existing = await readFile(CREDITS, 'utf8');
  } catch {
    existing = '# Crédits\n\n';
  }
  const block = lines.join('\n');
  const start = existing.indexOf(BEGIN);
  const end = existing.indexOf(END);
  const next =
    start >= 0 && end > start
      ? `${existing.slice(0, start)}${block}${existing.slice(end + END.length)}`
      : `${existing.trimEnd()}\n\n${block}\n`;
  await writeFile(CREDITS, next, 'utf8');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
