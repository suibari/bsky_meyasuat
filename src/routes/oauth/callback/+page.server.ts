import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { upsertUser, createSession } from '$lib/server/db.js';
import { makeCookieValue, cookieName } from '$lib/server/session.js';
import { getHandleFromDid } from '$lib/server/atproto.js';
import { isSafeRedirect } from '$lib/server/redirect.js';

export const load: PageServerLoad = ({ platform }) => {
	const appUrl = platform?.env?.PUBLIC_APP_URL ?? '';
	return { appUrl };
};

export const actions: Actions = {
	default: async ({ request, platform, cookies }) => {
		const env = platform?.env;
		if (!env) error(503, 'Service unavailable');

		const fd = await request.formData();
		const did = (fd.get('did') as string | null)?.trim() ?? '';
		if (!did || !did.startsWith('did:')) error(400, 'Invalid DID');
		const redirectTo = isSafeRedirect((fd.get('redirect_to') as string | null)?.trim());

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

		// HMAC 署名付き Cookie を発行（cookies.set() で確実に設定 + 同一レスポンスでリダイレクト）
		const cookieValue = await makeCookieValue(session.sessionId, env.SESSION_SECRET);
		cookies.set(cookieName(), cookieValue, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: true,
			expires: new Date(session.expiresAt)
		});

		redirect(302, redirectTo ?? '/dashboard');
	}
};
