import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { upsertUser, createSession } from '$lib/server/db.js';
import { makeCookieValue, cookieName, cookieOptions } from '$lib/server/session.js';
import { getHandleFromDid } from '$lib/server/atproto.js';

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;
	if (!env) error(503, 'Service unavailable');

	const body = await request.json() as { did?: string };
	const did = typeof body.did === 'string' ? body.did.trim() : '';
	if (!did || !did.startsWith('did:')) error(400, 'Invalid DID');

	// DID が実在するか PLC Directory で確認し、ハンドルを取得
	const handle = await getHandleFromDid(did);
	if (!handle) error(401, 'Could not verify DID');

	// プロフィールを取得（表示名・アバター）
	let displayName: string | null = null;
	let avatarUrl: string | null = null;
	try {
		const profileRes = await fetch(
			`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`
		);
		if (profileRes.ok) {
			const profile = await profileRes.json() as { displayName?: string; avatar?: string };
			displayName = profile.displayName ?? null;
			avatarUrl = profile.avatar ?? null;
		}
	} catch { /* ignore */ }

	// users upsert
	await upsertUser(env, { did, handle, displayName, avatarUrl });

	// sessions 作成
	const session = await createSession(env, did);

	// HMAC 署名付き Cookie を発行
	const cookieValue = await makeCookieValue(session.sessionId, env.SESSION_SECRET);
	const expiresAt = new Date(session.expiresAt);

	return json({ ok: true }, {
		headers: {
			'Set-Cookie': `${cookieName()}=${cookieValue}; ${cookieOptions(expiresAt)}`
		}
	});
};
