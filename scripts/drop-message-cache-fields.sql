-- Q&A本文・回答状態はPDSレコードを正データにし、messagesは匿名未回答インボックス
-- とPDSレコード参照の最小状態へ縮小する。
ALTER TABLE messages
DROP COLUMN IF EXISTS answer,
DROP COLUMN IF EXISTS answered_at,
DROP COLUMN IF EXISTS answer_deleted_at,
DROP COLUMN IF EXISTS sender_did,
DROP COLUMN IF EXISTS bot_post_uri,
DROP COLUMN IF EXISTS ip_hash;
