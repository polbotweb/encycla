-- Provenance of imported questions: the Wikipedia article revision the content comes from and
-- the author of the Wikimedia Commons image (required by CC BY / CC BY-SA attribution).
ALTER TABLE questions ADD COLUMN image_author TEXT;
ALTER TABLE questions ADD COLUMN source_url TEXT;
ALTER TABLE questions ADD COLUMN source_revision INTEGER;
ALTER TABLE questions ADD COLUMN source_language TEXT;
ALTER TABLE questions ADD COLUMN source_license TEXT;
ALTER TABLE questions ADD COLUMN source_retrieved_at TEXT;
