import { describe, expect, it } from 'vitest';
import { formAffinity, type Candidate } from '../../scripts/wikimedia/distractors';
import {
  articleFallbackOrder,
  chooseLabel,
  displayName,
  formKey,
  isUsableLang,
  nativeChoice,
  orderOriginLanguages,
  resolveOptions,
  scientificChoice,
  trustedNativeNames,
  type LabelChoice,
  type NameForms,
  type OptionInput,
} from '../../scripts/wikimedia/forms';

const forms = (partial: Partial<NameForms>): NameForms => ({
  nativeNames: [],
  originLanguages: [],
  originLabels: {},
  ...partial,
});
const own = (label: string, lang = 'ar'): LabelChoice => ({ label, origin: 'wikipedia', lang });
const living = (label: string | null, taxon?: string): OptionInput => ({
  choice:
    label === null ? (taxon ? scientificChoice(forms({ taxonName: taxon })) : null) : own(label),
  living: true,
  forms: forms(taxon ? { taxonName: taxon } : {}),
});

describe('label fallback (D-108)', () => {
  it('prefers a real name, then the scientific name of a living thing', () => {
    const taxon = forms({ taxonName: 'Rana temporaria' });
    expect(
      chooseLabel({ language: 'ar', living: true, real: [own('ضفدع شائع')], forms: taxon }),
    ).toEqual(own('ضفدع شائع'));
    expect(chooseLabel({ language: 'ar', living: true, real: [], forms: taxon })).toEqual({
      label: 'Rana temporaria',
      origin: 'scientific-name',
      lang: 'la',
    });
    expect(chooseLabel({ language: 'ar', living: true, real: [], forms: forms({}) })).toBeNull();
  });

  it('uses the original name of other items, never one in the room language as "foreign"', () => {
    const item = forms({
      nativeNames: [
        { text: 'Teatro Amazonas official long name', lang: 'pt', property: 'P1448' },
        { text: 'Torre Latinoamericana', lang: 'es', property: 'P1705' },
      ],
    });
    expect(chooseLabel({ language: 'ar', living: false, real: [], forms: item })).toEqual({
      label: 'Torre Latinoamericana',
      origin: 'native-name',
      lang: 'es',
    });
    // A native label in the room language is a real name of that language.
    const english = forms({ nativeNames: [{ text: 'Big Ben', lang: 'en', property: 'P1705' }] });
    expect(chooseLabel({ language: 'en', living: false, real: [], forms: english })?.origin).toBe(
      'wikidata',
    );
    expect(nativeChoice(english, 'en')).toBeNull();
    // The label in the item's original language comes before an official name.
    const origin = forms({
      originLanguages: ['it'],
      originLabels: { it: 'duomo di Milano' },
      nativeNames: [
        { text: 'Cattedrale metropolitana della Natività', lang: 'it', property: 'P1448' },
      ],
    });
    expect(nativeChoice(origin, 'ar')?.label).toBe('Duomo di Milano');
    expect(chooseLabel({ language: 'ar', living: false, real: [], forms: undefined })).toBeNull();
  });

  it('ignores unusable language tags and overlong names', () => {
    expect(isUsableLang('mul')).toBe(false);
    expect(isUsableLang('zh-hans')).toBe(true);
    expect(isUsableLang('not a tag')).toBe(false);
    expect(scientificChoice(forms({ taxonName: 'x'.repeat(81) }))).toBeNull();
    expect(nativeChoice(forms({ nativeNames: [{ text: 'Rome', lang: 'mis' }] }), 'ar')).toBeNull();
    expect(displayName(' mont Ventoux ')).toBe('Mont Ventoux');
    expect(displayName('Ελλάδα')).toBe('Ελλάδα');
  });

  it('describes how an option is written', () => {
    expect(formKey(null)).toBe('none');
    expect(formKey(own('x'))).toBe('own');
    expect(formKey({ label: 'x', origin: 'scientific-name', lang: 'la' })).toBe('scientific');
    expect(formKey({ label: 'x', origin: 'native-name', lang: 'fr' })).toBe('foreign');
  });
});

describe('long original names (D-109)', () => {
  const thai = 'วัดอรุณราชวรารามราชวรมหาวิหาร';
  it('uses the English label for a long name in another script', () => {
    const item = forms({
      nativeNames: [{ text: thai, lang: 'th', property: 'P1705' }],
      englishLabel: 'Wat Arun',
      originAliases: { th: ['วัดอรุณ'] },
    });
    expect(nativeChoice(item, 'ar')).toEqual({
      label: 'Wat Arun',
      origin: 'native-name',
      lang: 'en',
    });
    // Without an English label, the longest short form the name starts with.
    const { englishLabel: _english, ...noEnglish } = item;
    void _english;
    expect(
      nativeChoice(
        { ...noEnglish, originAliases: { th: ['วัดอรุณ', 'วัดอรุณราชวราราม', 'วัดแจ้ง'] } },
        'ar',
      ),
    ).toEqual({ label: 'วัดอรุณราชวราราม', origin: 'native-name', lang: 'th' });
    expect(nativeChoice(noEnglish, 'ar')?.label).toBe('วัดอรุณ');
  });

  it('keeps a long Latin-script name unless it has a short form, and short names as they are', () => {
    const latin = forms({
      nativeNames: [{ text: 'Catedral Metropolitana de Brasília', lang: 'pt', property: 'P1705' }],
      englishLabel: 'Cathedral of Brasília',
    });
    expect(nativeChoice(latin, 'ar')?.label).toBe('Catedral Metropolitana de Brasília');
    expect(
      nativeChoice({ ...latin, originAliases: { pt: ['Catedral Metropolitana', 'Sé'] } }, 'ar')
        ?.label,
    ).toBe('Catedral Metropolitana');
    const short = forms({
      nativeNames: [{ text: '浅草観音', lang: 'ja' }],
      englishLabel: 'Sensō-ji',
    });
    expect(nativeChoice(short, 'ar')?.label).toBe('浅草観音');
    // English rooms never get the English label as an "original" name.
    const long = forms({ nativeNames: [{ text: thai, lang: 'th' }], englishLabel: 'Wat Arun' });
    expect(nativeChoice(long, 'en')?.lang).toBe('th');
  });
});

describe('native-name guard (D-110)', () => {
  it('ignores class designations given as official names of a kind of thing', () => {
    const flute = forms({
      isClass: true,
      nativeNames: [
        { text: 'Side-blown flutes', lang: 'en', property: 'P1448' },
        { text: 'Flauti traversi', lang: 'it', property: 'P1448' },
      ],
    });
    expect(trustedNativeNames(flute)).toEqual([]);
    expect(nativeChoice(flute, 'ar')).toBeNull();
    const bouzouki = forms({
      isClass: true,
      nativeNames: [{ text: 'Μπουζούκι', lang: 'el', property: 'P1705' }],
    });
    expect(nativeChoice(bouzouki, 'ar')).toEqual({
      label: 'Μπουζούκι',
      origin: 'native-name',
      lang: 'el',
    });
  });

  it('keeps only names in the original languages, and never a plural of the own label', () => {
    const basilica = forms({
      originLanguages: ['fr'],
      originLabels: { fr: 'basilique Saint-Sernin de Toulouse' },
      nativeNames: [{ text: 'Basilica de Sant Sarnin', lang: 'oc', property: 'P1705' }],
    });
    expect(nativeChoice(basilica, 'ar')?.label).toBe('Basilique Saint-Sernin de Toulouse');
    const plural = forms({
      originLanguages: ['de'],
      originLabels: { de: 'Flöte' },
      nativeNames: [{ text: 'Flötes', lang: 'de', property: 'P1705' }],
    });
    expect(trustedNativeNames(plural)).toEqual([]);
    expect(nativeChoice(plural, 'ar')?.label).toBe('Flöte');
  });
});

describe('option resolution (D-108)', () => {
  it('writes every living option by its scientific name when one needs it', () => {
    const result = resolveOptions(
      [
        living(null, 'Amanita muscaria'),
        living('بوليط', 'Boletus edulis'),
        living('غوشنة', 'Morchella esculenta'),
        living('روسولا', 'Russula emetica'),
      ],
      0,
      'ar',
    );
    expect(result).toEqual({
      ok: true,
      labels: ['Amanita muscaria', 'Boletus edulis', 'Morchella esculenta', 'Russula emetica'],
      origins: ['scientific-name', 'scientific-name', 'scientific-name', 'scientific-name'],
      langs: ['la', 'la', 'la', 'la'],
      uniform: true,
    });
  });

  it('drops a question whose answer alone would be written differently', () => {
    const result = resolveOptions(
      [living(null, 'Amanita muscaria'), living('أ'), living('ب'), living('ج')],
      0,
      'ar',
    );
    expect(result).toEqual({
      ok: false,
      reason: 'the answer would be the only option written differently',
    });
  });

  it('drops a question with an unnamed option, or two options of the same name', () => {
    expect(resolveOptions([living(null), living('أ'), living('ب'), living('ج')], 1, 'ar').ok).toBe(
      false,
    );
    const same = resolveOptions([living('أ'), living('أ'), living('ب'), living('ج')], 2, 'ar');
    expect(same).toEqual({ ok: false, reason: 'two options would have the same name' });
  });

  it('tells identical names apart with the full title, then the original name', () => {
    const titled: OptionInput = {
      choice: { ...own('مرسى'), full: 'مرسى (فيلم)' },
      living: false,
      forms: undefined,
    };
    const native: OptionInput = {
      choice: own('مرسى'),
      living: false,
      forms: forms({ nativeNames: [{ text: 'Marsa', lang: 'mt', property: 'P1705' }] }),
    };
    const plain = (label: string): OptionInput => ({
      choice: own(label),
      living: false,
      forms: undefined,
    });
    const titledResult = resolveOptions([titled, plain('مرسى'), plain('ب'), plain('ج')], 2, 'ar');
    expect(titledResult.ok && titledResult.labels).toEqual(['مرسى (فيلم)', 'مرسى', 'ب', 'ج']);
    const result = resolveOptions([plain('مرسى'), native, plain('ب'), plain('ج')], 2, 'ar');
    expect(result.ok && result.labels).toEqual(['مرسى', 'Marsa', 'ب', 'ج']);
    expect(result.ok && result.langs).toEqual(['ar', 'mt', 'ar', 'ar']);
  });
});

describe('article fallback (D-108)', () => {
  it('prefers English then the original language in Arabic rooms, French last', () => {
    expect(articleFallbackOrder('ar', ['it', 'fr'])).toEqual([
      'en',
      'it',
      'de',
      'es',
      'pt',
      'nl',
      'fr',
    ]);
    expect(articleFallbackOrder('en', ['pt-br'])).toEqual(['pt', 'de', 'es', 'it', 'nl', 'fr']);
    expect(articleFallbackOrder('en', ['ja']).at(-1)).toBe('fr');
  });
});

describe('distractor form affinity', () => {
  const candidate = (forms?: Candidate['forms']): Candidate => ({
    id: 'x',
    category: 'Mushrooms',
    group: 'g',
    question: 'q',
    label: 'x',
    pageId: 1,
    qid: undefined,
    ...(forms ? { forms } : {}),
  });
  it('ranks distractors written like the answer first and unnamed ones last', () => {
    const target = candidate({ ar: 'scientific', en: 'own' });
    expect(formAffinity(target, candidate({ ar: 'scientific', en: 'own' }))).toBe(2);
    expect(formAffinity(target, candidate({ ar: 'own', en: 'own' }))).toBe(1);
    expect(formAffinity(target, candidate({ ar: 'none', en: 'own' }))).toBe(-1);
    expect(formAffinity(target, candidate())).toBe(0);
  });
});

describe('original language order (D-112)', () => {
  it('ranks English last unless it is the item’s own language', () => {
    expect(
      orderOriginLanguages([
        { code: 'en', via: 'P495' },
        { code: 'hi', via: 'P495' },
      ]),
    ).toEqual(['hi', 'en']);
    expect(
      orderOriginLanguages([
        { code: 'en', via: 'P37' },
        { code: 'ga', via: 'P495' },
      ]),
    ).toEqual(['ga', 'en']);
    expect(
      orderOriginLanguages([
        { code: 'en', via: 'P407' },
        { code: 'cy', via: 'P495' },
      ]),
    ).toEqual(['en', 'cy']);
    expect(
      orderOriginLanguages([
        { code: 'it', via: 'P17' },
        { code: 'la', via: 'P364' },
        { code: 'la', via: 'P17' },
      ]),
    ).toEqual(['la', 'it']);
  });
});
