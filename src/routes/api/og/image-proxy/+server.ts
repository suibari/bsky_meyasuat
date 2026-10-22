import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';

// Bluesky CDN の画像はCORSヘッダーが無く、ブラウザでのOGP描画に使えないため同一オリジンで中継する。
// 本文はストリームのまま流すだけなのでCPUはほぼ使わない。オープンプロキシにならないよう
// ログイン済み・cdn.bsky.app の画像パスに限定する。
const ALLOWED_PREFIX = 'https://cdn.bsky.app/img/';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');
	const target = url.searchParams.get('url');
	if (!target || !target.startsWith(ALLOWED_PREFIX)) error(400, 'Invalid url');

	// satori は WebP をデコードできないため @jpeg を付けて取得する(既に付いていれば二重付与しない)
	const fetchUrl = target.endsWith('@jpeg') ? target : `${target}@jpeg`;
	const res = await fetch(fetchUrl);
	if (!res.ok) error(res.status === 404 ? 404 : 502, 'Upstream error');

	return new Response(res.body, {
		headers: {
			'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
			'Cache-Control': 'private, max-age=3600'
		}
	});
};
