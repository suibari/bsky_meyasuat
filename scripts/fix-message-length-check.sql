-- 現状の CHECK 制約定義を確認してから、必要に応じて下記を実行すること:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'messages'::regclass AND contype = 'c';

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_body_check;
ALTER TABLE messages ADD CONSTRAINT messages_body_check CHECK (char_length(body) <= 10000);

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_answer_check;
ALTER TABLE messages ADD CONSTRAINT messages_answer_check CHECK (answer IS NULL OR char_length(answer) <= 10000);
