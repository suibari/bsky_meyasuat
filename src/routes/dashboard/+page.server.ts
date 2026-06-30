import type { PageServerLoad } from './$types';
import { getMessages, getAnsweredMessages, countUnread, getUserByDid } from '$lib/server/db.js';
import { r2KeyToUrl } from '$lib/server/r2.js';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	const env = platform?.env;
	const user = locals.user;
	// Cookie 未送信などで user が無い場合は 500 にせず空で返す（layout が /signin へリダイレクト）
	if (!user) {
		return { messages: [], unreadCount: 0, page: 0, tab: 'unread', appUrl: env?.PUBLIC_APP_URL ?? '' };
	}
	const page = Math.max(0, parseInt(url.searchParams.get('page') ?? '0', 10));
	const tabParam = url.searchParams.get('tab');
	const tab = tabParam === 'read' ? 'read' : tabParam === 'answered' ? 'answered' : 'unread';
	const limit = 20;

	const [messages, unreadCount] = await Promise.all([
		env
			? tab === 'answered'
				? getAnsweredMessages(env, user.did, { limit, offset: page * limit })
				: getMessages(env, user.did, {
						limit,
						offset: page * limit,
						unreadOnly: tab === 'unread',
						readOnly: tab === 'read'
					})
			: [],
		env ? countUnread(env, user.did) : 0
	]);

	const enriched = await Promise.all(messages.map(async (m) => {
		let senderHandle = null;
		if (env && m.senderDid) {
			const sender = await getUserByDid(env, m.senderDid);
			if (sender) {
				senderHandle = sender.handle;
			}
		}
		return {
			...m,
			imageUrls: env ? m.imageKeys.map((k) => r2KeyToUrl(env, k)) : [],
			senderHandle
		};
	}));

	return {
		messages: enriched,
		unreadCount,
		page,
		tab,
		appUrl: env?.PUBLIC_APP_URL ?? ''
	};
};
