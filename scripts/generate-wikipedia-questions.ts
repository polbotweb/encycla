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
import {
  pickDistractors,
  sameParentTaxon,
  seededRandom,
  shuffle,
  taxonomicCloseness,
  type Candidate,
} from './wikimedia/distractors';
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
import {
  ARTICLE_LANGUAGES,
  articleFallbackOrder,
  GENERIC_ARTICLE_LANGUAGES,
  baseLang,
  chooseLabel,
  formKey,
  isUsableLang,
  LONG_NATIVE,
  orderOriginLanguages,
  resolveOptions,
  type LabelChoice,
  type NameForms,
} from './wikimedia/forms';
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
const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
/** Categories of living things: their distractors follow the Wikidata taxonomy (P171). */
const LIVING_CATEGORIES = new Set<string>([
  'Fauna',
  'Birds',
  'Insects',
  'Flora',
  'Trees',
  'Mushrooms',
]);
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

// ---------------------------------------------------------------- taxonomy

interface Taxonomy {
  /** Every ancestor taxon (P171, transitively). */
  lineage: Set<string>;
  /** Direct parent taxa (P171). */
  parents: Set<string>;
  /** Arabic common names (P1843, non-deprecated), preferred rank first. */
  arNames: string[];
}

interface SparqlBody {
  results?: { bindings?: Record<string, { value: string; 'xml:lang'?: string } | undefined>[] };
}

const entityId = (uri: string | undefined): string | undefined =>
  uri?.startsWith('http://www.wikidata.org/entity/') ? uri.slice(31) : undefined;

/** Ancestors, parents and Arabic common names of living things, from the Wikidata Query Service. */
async function fetchTaxonomy(qids: string[]): Promise<Map<string, Taxonomy>> {
  const out = new Map<string, Taxonomy>();
  const entry = (qid: string): Taxonomy => {
    let value = out.get(qid);
    if (!value) {
      value = { lineage: new Set(), parents: new Set(), arNames: [] };
      out.set(qid, value);
    }
    return value;
  };
  for (const batch of chunk([...new Set(qids)].sort(), 40)) {
    const values = batch.map((qid) => `wd:${qid}`).join(' ');
    const lineage = await client.get<SparqlBody>(WIKIDATA_SPARQL, {
      query: `SELECT ?item ?ancestor WHERE { VALUES ?item { ${values} } ?item wdt:P171+ ?ancestor . }`,
    });
    for (const row of lineage.body.results?.bindings ?? []) {
      const item = entityId(row.item?.value);
      const ancestor = entityId(row.ancestor?.value);
      if (item && ancestor) entry(item).lineage.add(ancestor);
    }
    const names = await client.get<SparqlBody>(WIKIDATA_SPARQL, {
      query:
        `SELECT ?item ?parent ?name ?rank WHERE { VALUES ?item { ${values} } ` +
        `OPTIONAL { ?item wdt:P171 ?parent . } ` +
        `OPTIONAL { ?item p:P1843 ?statement . ?statement ps:P1843 ?name ; wikibase:rank ?rank . ` +
        `FILTER(LANG(?name) = "ar" && ?rank != wikibase:DeprecatedRank) } }`,
    });
    const ranked = new Map<string, Map<string, number>>();
    for (const row of names.body.results?.bindings ?? []) {
      const item = entityId(row.item?.value);
      if (!item) continue;
      const parent = entityId(row.parent?.value);
      if (parent) entry(item).parents.add(parent);
      const name = row.name?.value?.trim();
      if (name && row.name?.['xml:lang'] === 'ar') {
        const preferred = row.rank?.value.endsWith('PreferredRank') ? 0 : 1;
        const list = ranked.get(item) ?? new Map<string, number>();
        list.set(name, Math.min(list.get(name) ?? 1, preferred));
        ranked.set(item, list);
      }
    }
    for (const [item, list] of ranked) {
      entry(item).arNames = [...list.entries()]
        .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], 'ar'))
        .map(([name]) => name);
    }
  }
  return out;
}

// ---------------------------------------------------------------- names without a translation

type ItemForms = NameForms & {
  /** Article titles in the original-language Wikipedias (`de` → title). */
  sitelinks: Record<string, string>;
};

const NAME_PROPERTIES: Record<string, 'native' | 'taxon'> = {
  P1705: 'native',
  P1448: 'native',
  P1559: 'native',
  P225: 'taxon',
};
/** How directly a property gives the item's language: language of the work first. */

/**
 * Scientific names, original names and original languages of items (Wikidata Query Service),
 * plus their labels and Wikipedia articles in those languages (D-108).
 */
async function fetchItemForms(qids: string[]): Promise<Map<string, ItemForms>> {
  const out = new Map<string, ItemForms>();
  const entry = (qid: string): ItemForms => {
    let value = out.get(qid);
    if (!value) {
      value = { nativeNames: [], originLanguages: [], originLabels: {}, sitelinks: {} };
      out.set(qid, value);
    }
    return value;
  };
  const sorted = [...new Set(qids)].sort();
  for (const qid of sorted) entry(qid);
  for (const batch of chunk(sorted, 80)) {
    const values = batch.map((qid) => `wd:${qid}`).join(' ');
    const names = await client.get<SparqlBody>(WIKIDATA_SPARQL, {
      query:
        `SELECT ?item ?p ?name WHERE { VALUES ?item { ${values} } ` +
        `VALUES ?p { wdt:P1705 wdt:P1448 wdt:P1559 wdt:P225 } ?item ?p ?name . }`,
    });
    const native = new Map<
      string,
      { text: string; lang: string; property: 'P1705' | 'P1559' | 'P1448'; rank: number }[]
    >();
    for (const row of names.body.results?.bindings ?? []) {
      const item = entityId(row.item?.value);
      const property = row.p?.value.split('/').pop() ?? '';
      const text = row.name?.value?.trim();
      if (!item || !text) continue;
      if (NAME_PROPERTIES[property] === 'taxon') {
        const current = entry(item).taxonName;
        // Several P225 values (synonyms): keep the alphabetically first for a stable output.
        if (!current || text.localeCompare(current) < 0) entry(item).taxonName = text;
      } else if (NAME_PROPERTIES[property] === 'native' && row.name?.['xml:lang']) {
        const list = native.get(item) ?? [];
        list.push({
          text,
          lang: row.name['xml:lang'],
          property: property as 'P1705' | 'P1559' | 'P1448',
          rank: Object.keys(NAME_PROPERTIES).indexOf(property),
        });
        native.set(item, list);
      }
    }
    for (const [item, list] of native) {
      entry(item).nativeNames = list
        .sort(
          (a, b) => a.rank - b.rank || a.lang.localeCompare(b.lang) || a.text.localeCompare(b.text),
        )
        .map(({ text, lang, property }) => ({ text, lang, property }));
    }

    const classes = await client.get<SparqlBody>(WIKIDATA_SPARQL, {
      query: `SELECT DISTINCT ?item WHERE { VALUES ?item { ${values} } ?item wdt:P279 ?class . }`,
    });
    for (const row of classes.body.results?.bindings ?? []) {
      const item = entityId(row.item?.value);
      if (item) entry(item).isClass = true;
    }

    const languages = await client.get<SparqlBody>(WIKIDATA_SPARQL, {
      query:
        `SELECT ?item ?via ?code WHERE { VALUES ?item { ${values} } ` +
        `{ VALUES ?via { wdt:P364 wdt:P407 wdt:P103 wdt:P2936 wdt:P37 } ?item ?via ?language . } UNION ` +
        `{ VALUES ?via { wdt:P495 wdt:P17 } ?item ?via ?country . ?country wdt:P37 ?language . } ` +
        `?language wdt:P424 ?code . }`,
    });
    const found = new Map<string, { code: string; via: string }[]>();
    for (const row of languages.body.results?.bindings ?? []) {
      const item = entityId(row.item?.value);
      const via = row.via?.value.split('/').pop() ?? '';
      const code = row.code?.value?.trim().toLowerCase();
      if (!item || !code || !isUsableLang(code)) continue;
      const list = found.get(item) ?? [];
      list.push({ code, via });
      found.set(item, list);
    }
    for (const [item, list] of found) {
      entry(item).originLanguages = orderOriginLanguages(list);
    }
  }

  // Labels in the original languages and articles in the other Wikipedias, 50 items per request.
  for (const batch of chunk(sorted, 50)) {
    const codes = [...new Set(batch.flatMap((qid) => entry(qid).originLanguages))].sort();
    const sites = [
      ...new Set(
        [...codes.map(baseLang), ...GENERIC_ARTICLE_LANGUAGES]
          .filter((code) => ARTICLE_LANGUAGES.has(code) && !['fr', 'en', 'ar'].includes(code))
          .map((code) => `${code}wiki`),
      ),
    ].sort();
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
      props: codes.length > 0 ? 'labels|sitelinks' : 'sitelinks',
      ...(codes.length > 0 ? { languages: codes.join('|') } : {}),
      sitefilter: sites.join('|'),
    });
    for (const [qid, entity] of Object.entries(body.entities ?? {})) {
      const forms = out.get(qid);
      if (!forms) continue;
      for (const code of forms.originLanguages) {
        const label = entity.labels?.[code]?.value?.trim();
        if (label) forms.originLabels[code] = label;
      }
      for (const [site, link] of Object.entries(entity.sitelinks ?? {})) {
        if (link.title && site.endsWith('wiki')) forms.sitelinks[site.slice(0, -4)] = link.title;
      }
    }
  }

  // Short and international forms of long original names (D-109): English label and aliases in
  // the original languages, only for items that have an original name at all.
  const named = sorted.filter((qid) => {
    const forms = entry(qid);
    return [
      ...forms.nativeNames.map((name) => name.text),
      ...Object.values(forms.originLabels),
    ].some((text) => text.trim().length > LONG_NATIVE);
  });
  for (const batch of chunk(named, 10)) {
    const codes = [
      ...new Set(
        batch.flatMap((qid) => [
          ...entry(qid).originLanguages,
          ...entry(qid).nativeNames.map((name) => name.lang),
        ]),
      ),
    ]
      .filter(isUsableLang)
      .sort()
      .slice(0, 49);
    const { body } = await client.get<{
      entities?: Record<
        string,
        {
          labels?: Record<string, { value?: string }>;
          aliases?: Record<string, { value?: string }[]>;
        }
      >;
    }>(WIKIDATA_API, {
      action: 'wbgetentities',
      ids: batch.join('|'),
      props: 'labels|aliases',
      languages: [...new Set(['en', ...codes])].join('|'),
    });
    for (const [qid, entity] of Object.entries(body.entities ?? {})) {
      const forms = out.get(qid);
      if (!forms) continue;
      const english = entity.labels?.en?.value?.trim();
      if (english) forms.englishLabel = english;
      for (const [code, aliases] of Object.entries(entity.aliases ?? {})) {
        if (code === 'en') continue;
        const values = aliases.map((alias) => alias.value?.trim() ?? '').filter(Boolean);
        if (values.length > 0) (forms.originAliases ??= {})[code] = values;
      }
    }
  }
  return out;
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
  /** Answer label in this language, or `null` when the item has no name to show (D-108). */
  choice: LabelChoice | null;
  living: boolean;
  forms: NameForms | undefined;
  articleTitle: string;
  body: string;
  /** Raw extract the explanation sentence is taken from (only in the room language). */
  extract: string;
  source: QuestionSource;
  article: 'wikipedia' | 'other-language';
}

type SubjectTranslations = Record<TranslatedLanguage, LangContent>;

function permalink(language: string, title: string, revisionId: number): string {
  return `https://${language}.wikipedia.org/w/index.php?title=${encodeURIComponent(title.replace(/ /g, '_'))}&oldid=${revisionId}`;
}

const ARTICLE_LICENSE = 'CC BY-SA 4.0';

interface ArticleText {
  title: string;
  body: string;
  extract: string;
  source: QuestionSource;
}

/** Usable article text of a resolved page (long enough, not a disambiguation page). */
function articleText(
  page: (WikiPage & { fetchedAt: string }) | undefined,
  language: string,
): ArticleText | null {
  if (
    page === undefined ||
    page.missing ||
    page.pageprops?.disambiguation !== undefined ||
    page.lastrevid === undefined ||
    page.extract === undefined
  ) {
    return null;
  }
  const body = buildArticleBody(page.extract, MAX_ARTICLE_CHARS, language);
  if (body.length < MIN_ARTICLE_CHARS) return null;
  return {
    title: page.title,
    body,
    extract: page.extract,
    source: {
      url: permalink(language, page.title, page.lastrevid),
      revisionId: page.lastrevid,
      language,
      license: ARTICLE_LICENSE,
      retrievedAt: page.fetchedAt,
    },
  };
}

async function resolveWithLongExtracts(
  titles: string[],
  language: string,
): Promise<Map<string, WikiPage & { fetchedAt: string }>> {
  const endpoint = `https://${language}.wikipedia.org/w/api.php`;
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
  return pages;
}

/**
 * English and Arabic content for the selected subjects, from the *same Wikidata items* (D-108):
 *   label   = title of the Wikipedia article in that language (via the Wikidata sitelink), else
 *             the Wikidata label / Arabic common name, else the scientific name (living things)
 *             or the original name (other items), else none: not offered in that language;
 *   article = the article in that language, else the best other real article (Arabic: English
 *             first, then the original language; English: the original language), French last.
 */
async function fetchTranslations(
  subjects: (Subject & { label: string; body: string })[],
  taxonomy: Map<string, Taxonomy>,
  itemForms: Map<string, ItemForms>,
): Promise<Map<Subject, SubjectTranslations>> {
  const entities = await fetchWikidataEntities(
    subjects.flatMap((subject) => (subject.qid ? [subject.qid] : [])),
  );
  const out = new Map<Subject, SubjectTranslations>();
  const pagesByLanguage = new Map<string, Map<string, WikiPage & { fetchedAt: string }>>();
  for (const language of TRANSLATED_LANGUAGES) {
    const titles = subjects.flatMap((subject) => {
      const title = subject.qid ? entities.get(subject.qid)?.sitelinks[language] : undefined;
      return title ? [title] : [];
    });
    pagesByLanguage.set(language, await resolveWithLongExtracts(titles, language));
  }
  const ownArticle = (subject: Subject, language: string): ArticleText | null => {
    const entity = subject.qid ? entities.get(subject.qid) : undefined;
    const title = language === 'en' || language === 'ar' ? entity?.sitelinks[language] : undefined;
    return title ? articleText(pagesByLanguage.get(language)?.get(title), language) : null;
  };

  // Original-language articles, only for the subjects that may need them.
  const wanted = new Map<string, string[]>();
  for (const subject of subjects) {
    const forms = subject.qid ? itemForms.get(subject.qid) : undefined;
    if (!forms) continue;
    for (const language of TRANSLATED_LANGUAGES) {
      if (ownArticle(subject, language)) continue;
      for (const code of articleFallbackOrder(language, forms.originLanguages)) {
        if (['fr', 'en', 'ar'].includes(code)) continue;
        const title = forms.sitelinks[code];
        if (title) wanted.set(code, [...(wanted.get(code) ?? []), title]);
      }
    }
  }
  for (const [code, titles] of [...wanted.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    pagesByLanguage.set(code, await resolveWithLongExtracts(titles, code));
  }

  for (const subject of subjects) {
    const entity = subject.qid ? entities.get(subject.qid) : undefined;
    const forms = subject.qid ? itemForms.get(subject.qid) : undefined;
    const kind = subject.kind;
    const living = LIVING_CATEGORIES.has(subject.category);
    const french: ArticleText = {
      title: subject.seedTitle,
      body: subject.body,
      extract: subject.extract,
      source: {
        url: permalink(LANG, subject.title, subject.revisionId),
        revisionId: subject.revisionId,
        language: LANG,
        license: ARTICLE_LICENSE,
        retrievedAt: subject.fetchedAt,
      },
    };
    const result = {} as SubjectTranslations;

    for (const language of TRANSLATED_LANGUAGES) {
      const siteTitle = entity?.sitelinks[language];
      const page = siteTitle ? pagesByLanguage.get(language)?.get(siteTitle) : undefined;
      const pageUsable =
        page !== undefined &&
        !page.missing &&
        page.pageprops?.disambiguation === undefined &&
        page.lastrevid !== undefined &&
        page.extract !== undefined;

      const real: LabelChoice[] = [];
      if (pageUsable) {
        real.push({
          label: translatedLabel(page.title, kind, language),
          origin: 'wikipedia',
          lang: language,
          full: page.title,
        });
      }
      const wikidataLabel = entity?.labels[language];
      if (wikidataLabel) {
        real.push({
          label: translatedLabel(wikidataLabel, kind, language),
          origin: 'wikidata',
          lang: language,
        });
      }
      // Living things without an Arabic article or label: the Arabic common name (P1843).
      const commonName =
        language === 'ar' && subject.qid ? taxonomy.get(subject.qid)?.arNames[0] : undefined;
      if (commonName) {
        real.push({
          label: translatedLabel(commonName, kind, language),
          origin: 'wikidata',
          lang: language,
        });
      }
      const choice = chooseLabel({ language, living, real, forms });

      let article: ArticleText | null = ownArticle(subject, language);
      const isOwn = article !== null;
      if (!article) {
        for (const code of articleFallbackOrder(language, forms?.originLanguages ?? [])) {
          if (code === 'fr') {
            article = french;
          } else if (code === 'en' || code === 'ar') {
            article = ownArticle(subject, code);
          } else {
            const title = forms?.sitelinks[code];
            article = title ? articleText(pagesByLanguage.get(code)?.get(title), code) : null;
          }
          if (article) break;
        }
      }
      const chosenArticle = article ?? french;
      result[language] = {
        choice,
        living,
        forms,
        articleTitle: chosenArticle.title,
        body: chosenArticle.body,
        extract: chosenArticle.extract,
        source: chosenArticle.source,
        article: isOwn ? 'wikipedia' : 'other-language',
      };
    }
    out.set(subject, result);
  }
  return out;
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

  // 5b. Living things: Wikidata taxonomy (closer distractors, Arabic common names).
  const living = selected.filter(
    (subject) => LIVING_CATEGORIES.has(subject.category) && subject.qid,
  );
  console.log(`Fetching the Wikidata taxonomy of ${living.length} living things…`);
  const taxonomy = await fetchTaxonomy(living.map((subject) => subject.qid as string));

  // 5c. English and Arabic content of the same items (Wikidata sitelinks and labels).
  console.log(`Fetching scientific and original names of ${selected.length} items…`);
  const itemForms = await fetchItemForms(
    selected.flatMap((subject) => (subject.qid ? [subject.qid] : [])),
  );
  const translations = await fetchTranslations(selected, taxonomy, itemForms);

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
      forms: Object.fromEntries(
        TRANSLATED_LANGUAGES.map((language) => [
          language,
          formKey((translations.get(subject) as SubjectTranslations)[language].choice),
        ]),
      ),
      ...(LIVING_CATEGORIES.has(subject.category) && subject.qid && taxonomy.has(subject.qid)
        ? {
            lineage: (taxonomy.get(subject.qid) as Taxonomy).lineage,
            parents: (taxonomy.get(subject.qid) as Taxonomy).parents,
          }
        : {}),
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
  const sameGenus: { id: string; answer: string; distractor: string }[] = [];
  const kinship: number[] = [];
  for (const candidate of candidates) {
    const { subject } = candidate;
    const random = seededRandom(candidate.id);
    const distractors = pickDistractors(candidate, candidates, random);
    if (!distractors) {
      drop(subject.category, subject.seedTitle, 'not enough distractors of the same kind');
      continue;
    }

    for (const distractor of distractors) {
      if (sameParentTaxon(candidate, distractor)) {
        sameGenus.push({ id: candidate.id, answer: candidate.label, distractor: distractor.label });
      }
    }
    if (candidate.lineage) {
      kinship.push(
        distractors.reduce((sum, item) => sum + taxonomicCloseness(candidate, item), 0) /
          distractors.length,
      );
    }

    const options = shuffle([candidate, ...distractors] as (typeof candidates)[number][], random);
    const correctIndex = options.findIndex((option) => option.id === candidate.id);
    const sentence = firstSentence(subject.extract, 430);
    const explanation = sentence
      ? `${PHRASES.correctAnswer.fr} : ${subject.label}. ${sentence}`
      : `${PHRASES.correctAnswer.fr} : ${subject.label}. ${PHRASES.sourceFallback.fr}`;

    const optionInputs = options.map((option) => option.subject);
    const own = translations.get(subject) as SubjectTranslations;
    const translated: Partial<Record<TranslatedLanguage, QuestionTranslation>> = {};
    const unavailable: Partial<Record<TranslatedLanguage, string>> = {};
    for (const language of TRANSLATED_LANGUAGES) {
      const content = own[language];
      const resolved = resolveOptions(
        optionInputs.map((option) => {
          const item = (translations.get(option) as SubjectTranslations)[language];
          return { choice: item.choice, living: item.living, forms: item.forms };
        }),
        correctIndex,
        language,
      );
      if (!resolved.ok) {
        unavailable[language] = resolved.reason;
        continue;
      }
      const { labels, origins, langs } = resolved;
      const answer = labels[correctIndex] as string;
      const prefix = `${PHRASES.correctAnswer[language]}: ${answer}. `;
      const limit = Math.min(430, 495 - prefix.length);
      // The explanation stays in the room language: a sentence only from an article in it.
      const localizedSentence =
        content.article === 'wikipedia' ? firstSentence(content.extract, limit, language) : '';
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
          optionLanguages: langs,
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
      ...(Object.keys(unavailable).length > 0 ? { unavailable } : {}),
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
  await writeReport(questions, seedEntries.length, {
    livingThings: living.length,
    withLineage: living.filter((subject) => taxonomy.get(subject.qid as string)?.lineage.size)
      .length,
    arabicCommonNamesAvailable: living.filter(
      (subject) => (taxonomy.get(subject.qid as string)?.arNames.length ?? 0) > 0,
    ).length,
    meanSharedAncestors:
      kinship.length === 0
        ? 0
        : Math.round((kinship.reduce((sum, value) => sum + value, 0) / kinship.length) * 10) / 10,
    // Same direct parent taxon (usually the genus): to be reviewed for look-alike pictures.
    sameGenusPairs: sameGenus,
  });
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

async function writeReport(
  questions: QuestionRecord[],
  seedCount: number,
  taxonomy: Record<string, unknown>,
): Promise<void> {
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
    taxonomy,
    imageLicenses: licenses,
    dropReasons: reasons,
    redirects,
    dropped: drops,
  };
  await mkdir(dirname(REPORT), { recursive: true });
  await writeFile(REPORT, await formatJson(report, REPORT), 'utf8');
}

type OriginCounts = Record<TranslationOrigin, number>;

const blankOrigins = (): OriginCounts => ({
  wikipedia: 0,
  wikidata: 0,
  'scientific-name': 0,
  'native-name': 0,
});

const bump = (counts: Record<string, number>, key: string): void => {
  counts[key] = (counts[key] ?? 0) + 1;
};

/**
 * Per language and per category: where every answer label, every distractor label and every
 * article of the translations comes from (D-108), the languages of the original names, and the
 * questions not offered in that language with the reason.
 */
function translationReport(questions: QuestionRecord[]): Record<string, unknown> {
  const report: Record<string, unknown> = {};
  for (const language of TRANSLATED_LANGUAGES) {
    const labels = blankOrigins();
    const options = blankOrigins();
    const articles: Record<string, number> = {};
    const nativeNameLanguages: Record<string, number> = {};
    const categories: Record<
      string,
      {
        questions: number;
        unavailable: number;
        labels: OriginCounts;
        options: OriginCounts;
        articles: Record<string, number>;
      }
    > = {};
    const fallbacks: Array<{ id: string; subject: string; label: string; article: string }> = [];
    const unavailable: Array<{ id: string; subject: string; reason: string }> = [];

    for (const question of questions) {
      const entry = (categories[question.category] ??= {
        questions: 0,
        unavailable: 0,
        labels: blankOrigins(),
        options: blankOrigins(),
        articles: {},
      });
      const translation = question.translations?.[language];
      if (!translation) {
        entry.unavailable += 1;
        unavailable.push({
          id: question.id,
          subject: question.subject,
          reason: question.unavailable?.[language] ?? 'missing',
        });
        continue;
      }
      const provenance = translation.provenance;
      entry.questions += 1;
      labels[provenance.label] += 1;
      entry.labels[provenance.label] += 1;
      const articleKey =
        provenance.article === 'wikipedia' ? 'own' : `other:${translation.source.language}`;
      bump(articles, articleKey);
      bump(entry.articles, articleKey);
      provenance.options.forEach((origin, index) => {
        options[origin] += 1;
        entry.options[origin] += 1;
        if (origin === 'native-name') {
          bump(nativeNameLanguages, provenance.optionLanguages[index] ?? '?');
        }
      });
      if (provenance.label !== 'wikipedia' && provenance.label !== 'wikidata') {
        fallbacks.push({
          id: question.id,
          subject: question.subject,
          label: `${provenance.label}:${provenance.optionLanguages[question.correctIndex]}`,
          article: articleKey,
        });
      }
    }
    report[language] = {
      answerLabels: labels,
      optionLabels: options,
      articles,
      nativeNameLanguages,
      perCategory: categories,
      answersWithoutOwnName: fallbacks.length,
      fallbacks,
      notOffered: unavailable.length,
      unavailable,
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
    `Les textes (réponses, explications, articles) proviennent de Wikipédia (${LANG}, et ${TRANSLATED_LANGUAGES.join(', ')} pour les traductions), disponibles sous licence [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.fr). Chaque question conserve le permalien de la révision de l’article utilisée, pour chaque langue (champ \`source\` de \`data/questions.json\` et \`translations.<langue>.source\`). Les libellés sans article dans une langue viennent de Wikidata ([CC0](https://creativecommons.org/publicdomain/zero/1.0/deed.fr)) : libellé, nom scientifique (P225) ou nom d’origine (P1705, P1448, P1559, libellé dans la langue d’origine) ; l’origine de chaque libellé est enregistrée dans \`translations.<langue>.provenance\`. Quand une langue n’a pas d’article, l’article d’une autre langue est utilisé et crédité (« ar → en »).`,
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
        if (!translation) return '—';
        return translation.provenance.article === 'wikipedia'
          ? `[${language}](${translation.source.url})`
          : `${language} → [${translation.source.language}](${translation.source.url})`;
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
