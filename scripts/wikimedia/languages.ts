/**
 * Language-specific parts of the generator: fixed phrases, the question wording per kind of
 * subject, and the rules to turn an article title into an answer label.
 *
 * The *content* (labels, article text) is never written here: it always comes from Wikipedia /
 * Wikidata. Only the wording of the question ("Quel est cet animal ?") is fixed text, translated
 * once per kind of subject.
 */
import type { TranslatedLanguage } from '../../shared/schemas';

export type Localized = Record<'fr' | TranslatedLanguage, string>;

export const PHRASES = {
  correctAnswer: { fr: 'Bonne réponse', en: 'Correct answer', ar: 'الإجابة الصحيحة' },
  sourceFallback: {
    fr: 'Source : Wikipédia.',
    en: 'Source: Wikipedia.',
    ar: 'المصدر: ويكيبيديا.',
  },
  viaCommons: {
    fr: 'via Wikimedia Commons',
    en: 'via Wikimedia Commons',
    ar: 'عبر ويكيميديا كومنز',
  },
} as const satisfies Record<string, Localized>;

/** `AUTHOR, via Wikimedia Commons` in each language. */
export function creditLine(author: string, language: 'fr' | TranslatedLanguage): string {
  return language === 'ar'
    ? `${author} – ${PHRASES.viaCommons.ar}`
    : `${author}, ${PHRASES.viaCommons[language]}`;
}

/** French question text → translated question text. Keys are the French strings of the seeds. */
export const QUESTION_TEXT: Record<string, Pick<Localized, TranslatedLanguage>> = {
  'Quel est cet animal ?': { en: 'What is this animal?', ar: 'ما هذا الحيوان؟' },
  'Quelle est cette plante ?': { en: 'What is this plant?', ar: 'ما هذا النبات؟' },
  'Quel pays ce drapeau représente-t-il ?': {
    en: 'Which country does this flag represent?',
    ar: 'أيّ بلد يمثّله هذا العلم؟',
  },
  'Quel est cet oiseau ?': { en: 'What is this bird?', ar: 'ما هذا الطائر؟' },
  'Quel est cet arbre ?': { en: 'What is this tree?', ar: 'ما هذه الشجرة؟' },
  'Quel est cet insecte ?': { en: 'What is this insect?', ar: 'ما هذه الحشرة؟' },
  'Quel est ce champignon ?': { en: 'What is this mushroom?', ar: 'ما هذا الفطر؟' },
  'Quel est ce monument ou ce bâtiment ?': {
    en: 'What is this monument or building?',
    ar: 'ما هذا المَعلَم أو المبنى؟',
  },
  'Quelle est cette invention ?': { en: 'What is this invention?', ar: 'ما هذا الاختراع؟' },
  'Quelle est cette œuvre d’art ?': {
    en: 'What is this work of art?',
    ar: 'ما هذا العمل الفني؟',
  },
  'Quel écrivain est représenté ?': { en: 'Which writer is shown?', ar: 'مَن هذا الكاتب؟' },
  'Quel artiste est représenté ?': { en: 'Which artist is shown?', ar: 'مَن هذا الفنان؟' },
  'Quelle est cette montagne ou ce volcan ?': {
    en: 'What is this mountain or volcano?',
    ar: 'ما هذا الجبل أو البركان؟',
  },
  'Quel est ce site naturel ?': { en: 'What is this natural site?', ar: 'ما هذا الموقع الطبيعي؟' },
  'Quelle est cette ville ?': { en: 'What is this city?', ar: 'ما هذه المدينة؟' },
  'Quel est cet astre du système solaire ?': {
    en: 'What is this body of the Solar System?',
    ar: 'ما هذا الجرم من المجموعة الشمسية؟',
  },
  'Quel est cet objet du ciel profond ?': {
    en: 'What is this deep-sky object?',
    ar: 'ما هذا الجرم من أجرام السماء العميقة؟',
  },
  'Quel est cet engin spatial ?': {
    en: 'What is this spacecraft?',
    ar: 'ما هذه المركبة الفضائية؟',
  },
  'Quel personnage historique est représenté ?': {
    en: 'Which historical figure is shown?',
    ar: 'مَن هذه الشخصية التاريخية؟',
  },
  'Quel événement ou quel lieu historique est illustré ?': {
    en: 'Which historical event or place is shown?',
    ar: 'أيّ حدث أو موقع تاريخي يظهر في الصورة؟',
  },
  'Quelle figure mythologique est représentée ?': {
    en: 'Which mythological figure is depicted?',
    ar: 'أيّ شخصية أسطورية تظهر في الصورة؟',
  },
  'Quel est ce plat ou cette spécialité ?': {
    en: 'What is this dish or speciality?',
    ar: 'ما هذا الطبق أو هذه المأكولة؟',
  },
  'Quel est ce fromage ?': { en: 'What is this cheese?', ar: 'ما هذا الجبن؟' },
  'Quel est ce fruit ou ce légume ?': {
    en: 'What is this fruit or vegetable?',
    ar: 'ما هذه الفاكهة أو هذا الخضار؟',
  },
  'Quel est cet instrument de musique ?': {
    en: 'What is this musical instrument?',
    ar: 'ما هذه الآلة الموسيقية؟',
  },
  'Quel compositeur est représenté ?': { en: 'Which composer is shown?', ar: 'مَن هذا الملحّن؟' },
  'Quel sport est illustré ?': { en: 'Which sport is shown?', ar: 'أيّ رياضة تظهر في الصورة؟' },
  'Quel sportif est représenté ?': { en: 'Which athlete is shown?', ar: 'مَن هذا الرياضي؟' },
  'Quel scientifique est représenté ?': {
    en: 'Which scientist is shown?',
    ar: 'مَن هذا العالِم؟',
  },
  'Quel élément chimique est présenté ?': {
    en: 'Which chemical element is shown?',
    ar: 'ما هذا العنصر الكيميائي؟',
  },
  'Quel est ce minéral ou cette roche ?': {
    en: 'What is this mineral or rock?',
    ar: 'ما هذا المعدن أو الصخر؟',
  },
};

/** French alt text → translated alt text. Must never contain the answer. */
export const ALT_TEXT: Record<string, Pick<Localized, TranslatedLanguage>> = {
  'Photographie d’un animal à identifier': {
    en: 'Photograph of an animal to identify',
    ar: 'صورة فوتوغرافية لحيوان يجب التعرّف عليه',
  },
  'Photographie d’une plante à identifier': {
    en: 'Photograph of a plant to identify',
    ar: 'صورة فوتوغرافية لنبات يجب التعرّف عليه',
  },
  'Drapeau d’un pays à identifier': {
    en: 'Flag of a country to identify',
    ar: 'علم بلد يجب التعرّف عليه',
  },
  'Photographie d’un oiseau à identifier': {
    en: 'Photograph of a bird to identify',
    ar: 'صورة فوتوغرافية لطائر يجب التعرّف عليه',
  },
  'Photographie d’un arbre à identifier': {
    en: 'Photograph of a tree to identify',
    ar: 'صورة فوتوغرافية لشجرة يجب التعرّف عليها',
  },
  'Photographie d’un insecte à identifier': {
    en: 'Photograph of an insect to identify',
    ar: 'صورة فوتوغرافية لحشرة يجب التعرّف عليها',
  },
  'Photographie d’un champignon à identifier': {
    en: 'Photograph of a mushroom to identify',
    ar: 'صورة فوتوغرافية لفطر يجب التعرّف عليه',
  },
  'Photographie d’un monument ou d’un bâtiment à identifier': {
    en: 'Photograph of a monument or building to identify',
    ar: 'صورة فوتوغرافية لمَعلَم أو مبنى يجب التعرّف عليه',
  },
  'Photographie d’une invention à identifier': {
    en: 'Photograph of an invention to identify',
    ar: 'صورة فوتوغرافية لاختراع يجب التعرّف عليه',
  },
  'Reproduction d’une œuvre d’art à identifier': {
    en: 'Reproduction of a work of art to identify',
    ar: 'نسخة مصوّرة لعمل فني يجب التعرّف عليه',
  },
  'Portrait d’un écrivain à identifier': {
    en: 'Portrait of a writer to identify',
    ar: 'صورة شخصية لكاتب يجب التعرّف عليه',
  },
  'Portrait d’un artiste à identifier': {
    en: 'Portrait of an artist to identify',
    ar: 'صورة شخصية لفنان يجب التعرّف عليه',
  },
  'Photographie d’une montagne ou d’un volcan à identifier': {
    en: 'Photograph of a mountain or volcano to identify',
    ar: 'صورة فوتوغرافية لجبل أو بركان يجب التعرّف عليه',
  },
  'Photographie d’un site naturel à identifier': {
    en: 'Photograph of a natural site to identify',
    ar: 'صورة فوتوغرافية لموقع طبيعي يجب التعرّف عليه',
  },
  'Photographie d’une ville à identifier': {
    en: 'Photograph of a city to identify',
    ar: 'صورة فوتوغرافية لمدينة يجب التعرّف عليها',
  },
  'Image d’un astre du système solaire à identifier': {
    en: 'Image of a body of the Solar System to identify',
    ar: 'صورة لجرم من المجموعة الشمسية يجب التعرّف عليه',
  },
  'Image d’un objet du ciel profond à identifier': {
    en: 'Image of a deep-sky object to identify',
    ar: 'صورة لجرم من أجرام السماء العميقة يجب التعرّف عليه',
  },
  'Image d’un engin spatial à identifier': {
    en: 'Image of a spacecraft to identify',
    ar: 'صورة لمركبة فضائية يجب التعرّف عليها',
  },
  'Portrait ou représentation à identifier': {
    en: 'Portrait or depiction to identify',
    ar: 'صورة شخصية أو تصوير يجب التعرّف عليه',
  },
  'Illustration d’un événement ou d’un lieu historique à identifier': {
    en: 'Illustration of a historical event or place to identify',
    ar: 'صورة توضيحية لحدث أو موقع تاريخي يجب التعرّف عليه',
  },
  'Représentation d’une figure mythologique à identifier': {
    en: 'Depiction of a mythological figure to identify',
    ar: 'تصوير لشخصية أسطورية يجب التعرّف عليها',
  },
  'Photographie d’un plat ou d’une spécialité culinaire à identifier': {
    en: 'Photograph of a dish or culinary speciality to identify',
    ar: 'صورة فوتوغرافية لطبق أو مأكولة يجب التعرّف عليها',
  },
  'Photographie d’un fromage à identifier': {
    en: 'Photograph of a cheese to identify',
    ar: 'صورة فوتوغرافية لنوع من الجبن يجب التعرّف عليه',
  },
  'Photographie d’un fruit ou d’un légume à identifier': {
    en: 'Photograph of a fruit or vegetable to identify',
    ar: 'صورة فوتوغرافية لفاكهة أو خضار يجب التعرّف عليها',
  },
  'Photographie d’un instrument de musique à identifier': {
    en: 'Photograph of a musical instrument to identify',
    ar: 'صورة فوتوغرافية لآلة موسيقية يجب التعرّف عليها',
  },
  'Portrait d’un compositeur à identifier': {
    en: 'Portrait of a composer to identify',
    ar: 'صورة شخصية لملحّن يجب التعرّف عليه',
  },
  'Photographie d’un sport à identifier': {
    en: 'Photograph of a sport to identify',
    ar: 'صورة فوتوغرافية لرياضة يجب التعرّف عليها',
  },
  'Photographie d’un sportif à identifier': {
    en: 'Photograph of an athlete to identify',
    ar: 'صورة فوتوغرافية لرياضي يجب التعرّف عليه',
  },
  'Photographie d’un échantillon à identifier': {
    en: 'Photograph of a sample to identify',
    ar: 'صورة فوتوغرافية لعيّنة يجب التعرّف عليها',
  },
  'Photographie d’un minéral ou d’une roche à identifier': {
    en: 'Photograph of a mineral or rock to identify',
    ar: 'صورة فوتوغرافية لمعدن أو صخر يجب التعرّف عليه',
  },
};

/** Flags: the answer is the country, so the "flag of …" prefix is dropped from the title. */
const FLAG_PREFIX: Record<TranslatedLanguage, RegExp> = {
  en: /^(?:the\s+)?flag\s+of\s+(?:the\s+)?/i,
  ar: /^علم\s+/,
};

/** Answer label from an article title or a Wikidata label, in English or Arabic. */
export function translatedLabel(
  title: string,
  kind: 'title' | 'flag',
  language: TranslatedLanguage,
): string {
  let label = title.replace(/\s*[(（][^)）]*[)）]\s*$/, '').trim();
  if (kind === 'flag') {
    label = label.replace(FLAG_PREFIX[language], '');
    if (language === 'en') {
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }
  }
  return label.trim();
}
