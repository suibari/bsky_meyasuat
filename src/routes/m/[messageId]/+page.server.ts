import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getMessageById, getUserByDid } from '$lib/server/db.js';
import { r2KeyToUrl } from '$lib/server/r2.js';

export const load: PageServerLoad = async ({ params, platform }) => {
	const env = platform?.env;
	if (!env) error(503, 'Service unavailable');

	const message = await getMessageById(env, params.messageId);
	if (!message) error(404, 'Message not found');

	const creator = await getUserByDid(env, message.creatorDid);
	if (!creator) error(404, 'Creator not found');

	const appUrl = env.PUBLIC_APP_URL || '';

	return {
		message: {
			...message,
			imageUrls: message.imageKeys.map((k) => r2KeyToUrl(env, k))
		},
		creator: {
			did: creator.did,
			handle: creator.handle,
			displayName: creator.displayName,
			avatarUrl: creator.avatarUrl
		},
		appUrl
	};
};
