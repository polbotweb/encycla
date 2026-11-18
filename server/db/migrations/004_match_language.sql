-- Language of the questions of a match (room language, D-88). Older matches were French.
ALTER TABLE matches ADD COLUMN language TEXT NOT NULL DEFAULT 'fr'
  CHECK (language IN ('fr', 'en', 'ar'));

CREATE INDEX matches_language ON matches(language);
