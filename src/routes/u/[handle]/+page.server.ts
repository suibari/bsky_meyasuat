import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getUserByHandle, getAnsweredMessages } from '$lib/server/db.js';
import { resolveHandle } from '$lib/server/atproto.js';
import { r2KeyToUrl } from '$lib/server/r2.js';
export const load: PageServerLoad = async ({ params, platform, url }) => {
	const env = platform?.env;
	const handle = params.handle.replace(/^@/, '');

	// DB でハンドルを検索し、なければ AT Protocol で解決を試みる
	let user = env ? await getUserByHandle(env, handle) : null;

	if (!user && env) {
		const resolved = await resolveHandle(handle);
		if (resolved) {
			user = await getUserByHandle(env, resolved.did);
		}
	}

	if (!user) error(404, 'Creator not found');

	const appUrl = env?.PUBLIC_APP_URL ?? '';
	const turnstileSiteKey = env?.PUBLIC_TURNSTILE_SITE_KEY ?? '';
	const page = Math.max(0, parseInt(url.searchParams.get('page') ?? '0', 10));

	const answeredQA = env
		? (await getAnsweredMessages(env, user.did, { limit: 10, offset: page * 10 })).map((m) => ({
				id: m.id,
				body: m.body,
				answer: m.answer ?? '',
				createdAt: m.createdAt,
				answeredAt: m.answeredAt ?? '',
				imageUrls: m.imageKeys.map((k) => r2KeyToUrl(env, k))
			}))
		: [];

	return {
		creator: {
			did: user.did,
			handle: user.handle,
			displayName: user.displayName,
			avatarUrl: user.avatarUrl,
			boxName: user.boxName
		},
		appUrl,
		turnstileSiteKey,
		answeredQA,
		page
	};
};
