-- 記名質問の取り下げ判定を question_record_uri のPDSライブ確認に統一したため、
-- sender_deleted_at は表示判定・削除判定のどちらにも使わない。
ALTER TABLE messages
DROP COLUMN IF EXISTS sender_deleted_at;
