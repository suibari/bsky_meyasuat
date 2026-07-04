-- 改ざん検証をDB側のcid台帳(question_record_cid/answer_record_cid)から、
-- 回答レコード自身が刻む questionRef(strongRef)ベースの検証へ移行したため、
-- これらのカラムは不要になった。
ALTER TABLE messages
DROP COLUMN IF EXISTS question_record_cid,
DROP COLUMN IF EXISTS answer_record_cid;
