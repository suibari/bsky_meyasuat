import type { PageServerLoad } from './$types';
import { resolveHandle } from '$lib/server/atproto.js';
import { buildBlobCdnUrl } from '$lib/server/messageImages.js';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	const env = platform?.env;
	const botDid = env ? (await resolveHandle(env.BOT_HANDLE))?.did ?? null : null;
	const user = locals.user!;
	const backgroundImageUrl = user.backgroundImageCid
		? buildBlobCdnUrl(user.did, user.backgroundImageCid)
		: null;
	return {
		user,
		backgroundImageUrl,
		appUrl: env?.PUBLIC_APP_URL ?? '',
		botDid
	};
};

export const actions: Actions = {
	saveNotify: async ({ locals, request, platform }) => {
		const env = platform?.env;
		if (!locals.user || !env) return fail(401);
		await request.formData();
		return { saved: true };
	},
	saveRequireNamed: async ({ locals, request, platform }) => {
		const env = platform?.env;
		if (!locals.user || !env) return fail(401);
		await request.formData();
		return { saved: true };
	},
	saveBoxName: async ({ locals, request, platform }) => {
		const env = platform?.env;
		if (!locals.user || !env) return fail(401);
		await request.formData();
		return { saved: true };
	},
	saveOgAppearance: async ({ locals, request, platform }) => {
		const env = platform?.env;
		if (!locals.user || !env) return fail(401);
		await request.formData();
		return { saved: true };
	}
};
