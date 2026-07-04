ALTER TABLE messages
ADD COLUMN IF NOT EXISTS answer_record_uri text,
ADD COLUMN IF NOT EXISTS answer_record_cid text;
