import { DEFAULT_LANGUAGE, isLanguage, type Language } from '../../shared/languages';

const LOCALES: Record<Language, string> = { fr: 'fr_FR', en: 'en_GB', ar: 'ar_AR' };
const IMAGE = '/og/encycla-fr.png';

/**
 * Social preview meta of the served `index.html` (D-111). Crawlers do not run the client, so the
 * server picks the preview image of `?lang=` (French by default) and, when `PUBLIC_ORIGIN` is
 * set, makes `og:image` / `twitter:image` absolute as the Open Graph protocol requires and adds
 * `og:url`. Without an origin (development, tests) the image stays root-relative.
 */
export function socialIndex(html: string, origin: string | null, lang: unknown): string {
  const language: Language = isLanguage(lang) ? lang : DEFAULT_LANGUAGE;
  const base = origin ? origin.replace(/\/+$/, '') : '';
  const image = `${base}/og/encycla-${language}.png`;
  let out = html.split(`content="${IMAGE}"`).join(`content="${image}"`);
  if (language !== DEFAULT_LANGUAGE) {
    out = out
      .replace(
        `<meta property="og:locale:alternate" content="${LOCALES[language]}" />`,
        `<meta property="og:locale:alternate" content="${LOCALES[DEFAULT_LANGUAGE]}" />`,
      )
      .replace(
        `<meta property="og:locale" content="${LOCALES[DEFAULT_LANGUAGE]}" />`,
        `<meta property="og:locale" content="${LOCALES[language]}" />`,
      );
  }
  if (base) {
    const url = language === DEFAULT_LANGUAGE ? `${base}/` : `${base}/?lang=${language}`;
    out = out.replace(
      '<meta property="og:type" content="website" />',
      `<meta property="og:type" content="website" />\n    <meta property="og:url" content="${url}" />`,
    );
  }
  return out;
}
