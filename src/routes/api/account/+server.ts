import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getCreatorImageKeys, detachSentQuestions, deleteBoxAndRelatedData } from '$lib/server/db.js';
import { deleteManyFromR2 } from '$lib/server/r2.js';
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

	// 2. 自分が他人の箱へ送った質問を送信者側だけ切り離す（相手の回答は残す）
	await detachSentQuestions(env, did);

	// 3. 箱本体と関連データ（受信メッセージ・rate_limit_log・sessions・users）を削除
	await deleteBoxAndRelatedData(env, did);

	// 4. セッションCookieをクリアして返す
	const headers = new Headers();
	headers.set('Set-Cookie', `${cookieName()}=; ${clearCookieOptions()}`);
	return json({ ok: true }, { headers });
};
