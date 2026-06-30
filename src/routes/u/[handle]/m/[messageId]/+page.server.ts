import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getMessageById, getUserByDid, getAnsweredMessages } from '$lib/server/db.js';
import { r2KeyToUrl } from '$lib/server/r2.js';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	const env = platform?.env;
	if (!env) error(503, 'Service unavailable');

	const message = await getMessageById(env, params.messageId);
	if (!message) error(404, 'Message not found');

	const creator = await getUserByDid(env, message.creatorDid);
	if (!creator) error(404, 'Creator not found');

	const requestedHandle = params.handle.replace(/^@/, '');
	if (requestedHandle !== creator.handle) {
		redirect(301, `/u/${creator.handle}/m/${message.id}`);
	}

	let senderProfile = null;
	if (message.senderDid) {
		const sender = await getUserByDid(env, message.senderDid);
		if (sender) {
			senderProfile = {
				did: sender.did,
				handle: sender.handle,
				displayName: sender.displayName,
				avatarUrl: sender.avatarUrl
			};
		}
	}

	const appUrl = env.PUBLIC_APP_URL || '';
	const isOwner = locals.user?.did === message.creatorDid;

	const relatedQA = await getAnsweredMessages(env, message.creatorDid, {
		limit: 10,
		excludeId: message.id
	});

	return {
		message: {
			...message,
			imageUrls: message.imageKeys.map((k) => r2KeyToUrl(env, k)),
			sender: senderProfile
		},
		creator: {
			did: creator.did,
			handle: creator.handle,
			displayName: creator.displayName,
			avatarUrl: creator.avatarUrl,
			boxName: creator.boxName
		},
		appUrl,
		isOwner,
		relatedQA: relatedQA.map((m) => ({
			id: m.id,
			body: m.body,
			answer: m.answer ?? '',
			createdAt: m.createdAt,
			answeredAt: m.answeredAt ?? '',
			imageUrls: m.imageKeys.map((k) => r2KeyToUrl(env, k))
		}))
	};
};
