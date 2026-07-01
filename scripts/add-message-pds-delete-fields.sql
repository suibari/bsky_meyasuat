ALTER TABLE messages
ADD COLUMN IF NOT EXISTS answer_record_uri text,
ADD COLUMN IF NOT EXISTS answer_record_cid text,
ADD COLUMN IF NOT EXISTS sender_deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS answer_deleted_at timestamptz;
