import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getCreatorImageKeys, deleteBoxAndRelatedData } from '$lib/server/db.js';
import { deleteManyFromR2, deleteR2Prefix, ogImagePrefix } from '$lib/server/r2.js';
import { cookieName, clearCookieOptions } from '$lib/server/session.js';

// 質問箱（アカウント）を削除する。
// PDS上のレコード削除はサーバーからは行えないため、クライアント側で
// 自分のリポジトリの question/answer レコードを削除してから本エンドポイントを呼ぶ。
export const DELETE: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	if (!locals.user || !env) error(401, 'Unauthorized');

	const did = locals.user.did;

	// 1. 受信メッセージに紐づくR2画像を削除
	const imageKeys = await getCreatorImageKeys(env, did);
	await deleteManyFromR2(env, imageKeys);
	// ブラウザで事前生成して保存したOGP画像も削除
	await deleteR2Prefix(env, ogImagePrefix(did));

	// 2. 箱本体と関連データ（受信メッセージ・rate_limit_log・sessions・users）を削除
	// 自分が他人の箱へ送った質問は、クライアント側でPDSレコードを削除済みにする。
	// 相手側の一覧では question_record_uri のライブ404判定により非表示になる。
	await deleteBoxAndRelatedData(env, did);

	// 3. セッションCookieをクリアして返す
	const headers = new Headers();
	headers.set('Set-Cookie', `${cookieName()}=; ${clearCookieOptions()}`);
	return json({ ok: true }, { headers });
};
