// E2E用の最小限のPostgRESTモック。ログイン済みセッション1件とユーザー1件だけを返す。
// 値は tests/e2e/fixtures.ts と揃えること。
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_POSTGREST_PORT ?? 54330);
const SESSION_ID = 'e2e-session';
const USER = {
	did: 'did:plc:e2emeyasuattestuser00000',
	handle: 'e2e-user.test',
	display_name: 'E2Eテストユーザー',
	avatar_url: null,
	notify_enabled: false,
	share_handle_enabled: false,
	require_named_enabled: false,
	box_name: null,
	created_at: '2026-01-01T00:00:00.000Z',
	updated_at: '2026-01-01T00:00:00.000Z'
};

function json(res, status, body, headers = {}) {
	res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
	res.end(JSON.stringify(body));
}

createServer((req, res) => {
	const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
	const table = url.pathname.slice(1);
	const q = url.searchParams;

	if (req.method === 'GET' && table === 'sessions') {
		const now = Date.now();
		return json(res, 200, q.get('session_id') === `eq.${SESSION_ID}`
			? [{
				session_id: SESSION_ID,
				user_did: USER.did,
				// 1時間以内に作られたことにして、ハンドル同期(外部通信)を走らせない
				created_at: new Date(now).toISOString(),
				expires_at: new Date(now + 24 * 60 * 60 * 1000).toISOString()
			}]
			: []);
	}
	if (req.method === 'GET' && table === 'users') {
		const hit = q.get('did') === `eq.${USER.did}` || q.get('handle') === `eq.${USER.handle}`;
		return json(res, 200, hit ? [USER] : []);
	}
	// e2e-message で始まるIDのメッセージは、テストユーザー宛ての匿名(R2画像なし)メッセージとして返す。
	// IDを毎回変えればR2に保存済みのOGP画像が無い状態から試せる。
	if (req.method === 'GET' && table === 'messages') {
		const id = q.get('id')?.replace(/^eq\./, '');
		return json(res, 200, id?.startsWith('e2e-message')
			? [{
				id,
				creator_did: USER.did,
				body: 'E2Eテスト用の質問です',
				image_keys: [],
				is_read: false,
				created_at: '2026-01-01T00:00:00.000Z',
				question_record_uri: null,
				answer_record_uri: null
			}]
			: []);
	}
	if (req.method === 'GET' && table === 'rate_limit_log') {
		return json(res, 200, [], { 'Content-Range': '*/0' });
	}
	if (req.method === 'GET') return json(res, 200, []);
	// 書き込み系は受け付けるだけ
	req.resume();
	req.on('end', () => json(res, 201, []));
}).listen(PORT, '127.0.0.1', () => {
	console.log(`mock postgrest listening on ${PORT}`);
});
