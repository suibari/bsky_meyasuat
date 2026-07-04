-- ユーザー設定は com.suibari.meyasuat.config/self を正データに移管したため、
-- users テーブルの設定キャッシュ列を削除する。
ALTER TABLE users
DROP COLUMN IF EXISTS notify_enabled,
DROP COLUMN IF EXISTS share_handle_enabled,
DROP COLUMN IF EXISTS require_named_enabled,
DROP COLUMN IF EXISTS box_name;
