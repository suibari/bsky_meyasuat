import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getUserByHandle } from '$lib/server/db.js';
import { resolveHandle } from '$lib/server/atproto.js';
export const load: PageServerLoad = async ({ params, platform }) => {
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

	return {
		creator: {
			did: user.did,
			handle: user.handle,
			displayName: user.displayName,
			avatarUrl: user.avatarUrl
		},
		appUrl,
		turnstileSiteKey
	};
};
