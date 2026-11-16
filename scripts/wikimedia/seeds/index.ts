import type { QuestionCategory } from '../../../shared/schemas';
import { ARCHITECTURE, FLAGS } from './world';
import { ARTS, GEOGRAPHY, INVENTIONS, SPACE } from './culture';
import { BIRDS, FAUNA, FLORA, INSECTS, MUSHROOMS, TREES } from './nature';
import { GASTRONOMY, HISTORY, MUSIC, MYTHOLOGY, SCIENCE, SPORTS } from './society';
import type { SeedMap } from './types';

export const SEEDS: SeedMap = {
  Fauna: FAUNA,
  Flora: FLORA,
  Flags: FLAGS,
  Birds: BIRDS,
  Trees: TREES,
  Insects: INSECTS,
  Mushrooms: MUSHROOMS,
  Architecture: ARCHITECTURE,
  Inventions: INVENTIONS,
  'Arts & Literature': ARTS,
  Geography: GEOGRAPHY,
  'Space & Astronomy': SPACE,
  History: HISTORY,
  Mythology: MYTHOLOGY,
  Gastronomy: GASTRONOMY,
  Music: MUSIC,
  Sports: SPORTS,
  Science: SCIENCE,
};

export type { QuestionCategory };
