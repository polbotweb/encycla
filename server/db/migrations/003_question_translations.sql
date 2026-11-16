-- English and Arabic versions of a question (same item, same picture, same option order), as JSON
-- (see questionTranslationSchema in shared/schemas.ts). French stays in the regular columns.
ALTER TABLE questions ADD COLUMN translations_json TEXT;
