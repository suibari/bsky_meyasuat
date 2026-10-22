// E2E用の最小限のPostgRESTモック。ログイン済みセッション1件とユーザー1件だけを返す。
// 値は tests/e2e/fixtures.ts と揃えること。
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_POSTGREST_PORT ?? 54330);
const SESSION_ID = 'e2e-session';
const USER = {
	did: 'did:plc:e2emeyasuattestuser',
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
