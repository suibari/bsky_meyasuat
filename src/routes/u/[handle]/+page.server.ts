import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getUserByHandle } from '$lib/server/db.js';
import { resolveHandle } from '$lib/server/atproto.js';
import { getAnsweredMessagesFromPds, ingestCreatesFromPdsForUser, reconcileMessagesWithPds, resolveAnsweredContent } from '$lib/server/pdsSync.js';
import { isTurnstileEnabled } from '$lib/server/turnstile.js';

export const load: PageServerLoad = async ({ params, platform, url }) => {
	const env = platform?.env;
	const ctx = platform?.context;
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
	const turnstileEnabled = isTurnstileEnabled(url);
	const page = Math.max(0, parseInt(url.searchParams.get('page') ?? '0', 10));

	const answeredMessages = env
		? await getAnsweredMessagesFromPds(env, user.did, appUrl, { limit: 10, offset: page * 10 })
		: [];

	if (env) {
		const syncTask = (async () => {
			await ingestCreatesFromPdsForUser(env, user.did, appUrl);
			if (answeredMessages.length > 0) {
				await reconcileMessagesWithPds(env, answeredMessages);
			}
		})();
		if (ctx) {
			ctx.waitUntil(syncTask);
		} else {
			void syncTask.catch(() => {});
		}
	}

	const answeredQA = env
		? (await Promise.all(answeredMessages.map(async (m) => {
				const resolved = await resolveAnsweredContent(env, m);
				if (!resolved) return null;
				return {
					id: m.id,
					body: resolved.body,
					answer: resolved.answer,
					createdAt: m.createdAt,
					answeredAt: m.answeredAt ?? '',
					imageUrls: resolved.imageUrls
				};
			}))).filter((qa): qa is NonNullable<typeof qa> => qa !== null)
		: [];

	return {
		creator: {
			did: user.did,
			handle: user.handle,
			displayName: user.displayName,
			avatarUrl: user.avatarUrl,
			boxName: user.boxName,
			requireNamedEnabled: user.requireNamedEnabled
		},
		appUrl,
		turnstileSiteKey,
		turnstileEnabled,
		answeredQA,
		page
	};
};
