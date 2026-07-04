import type { PageServerLoad } from './$types';
import type { Message } from '$lib/server/db.js';
import { getMessages, getUserByDid } from '$lib/server/db.js';
import {
	countVisibleUnread,
	createRecordCache,
	filterMessagesByLiveQuestion,
	getAnsweredMessagesFromPds,
	getSentMessagesFromPds,
	resolveAnsweredContent,
	resolveQuestionContent
} from '$lib/server/pdsSync.js';

type UserSummary = {
	did: string;
	handle: string;
	displayName: string | null;
	avatarUrl: string | null;
};

type DashboardMessage = Message & {
	imageUrls: string[];
	sender: UserSummary | null;
	creator: UserSummary | null;
};

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	const env = platform?.env;
	const user = locals.user;
	// Cookie 未送信などで user が無い場合は 500 にせず空で返す（layout が / へリダイレクト）
	if (!user) {
		return { messages: Promise.resolve([] as DashboardMessage[]), unreadCount: 0, page: 0, tab: 'unread', appUrl: env?.PUBLIC_APP_URL ?? '' };
	}
	const page = Math.max(0, parseInt(url.searchParams.get('page') ?? '0', 10));
	const tabParam = url.searchParams.get('tab');
	const tab = tabParam === 'read'
		? 'read'
		: tabParam === 'answered'
			? 'answered'
			: tabParam === 'sent'
				? 'sent'
				: 'unread';
	const limit = 20;
	const cache = createRecordCache();

	const messages: Promise<DashboardMessage[]> = (async () => {
		if (!env) return [];

		const rawMessages = tab === 'answered'
			? await getAnsweredMessagesFromPds(env, user.did, env.PUBLIC_APP_URL ?? '', { limit, offset: page * limit })
			: tab === 'sent'
				? await getSentMessagesFromPds(env, user.did, env.PUBLIC_APP_URL ?? '', { limit, offset: page * limit })
				: await getMessages(env, user.did, {
						limit,
						offset: page * limit,
						unreadOnly: tab === 'unread',
						readOnly: tab === 'read'
					});
		const visibleMessages = tab === 'answered'
			? rawMessages
			: await filterMessagesByLiveQuestion(rawMessages, cache);

		const enrichedOrNull = await Promise.all(visibleMessages.map(async (m) => {
			let sender = null;
			let resolvedQuestion = null;
			if (tab !== 'answered') {
				resolvedQuestion = await resolveQuestionContent(m, cache);
				if (!resolvedQuestion) return null;
			}
			const senderDid = m.senderDid ?? resolvedQuestion?.senderDid ?? null;
			if (env && senderDid) {
				const senderUser = await getUserByDid(env, senderDid);
				if (senderUser) {
					sender = {
						did: senderUser.did,
						handle: senderUser.handle,
						displayName: senderUser.displayName,
						avatarUrl: senderUser.avatarUrl
					};
				}
			}

			let creator = null;
			if (env && tab === 'sent') {
				const creatorUser = await getUserByDid(env, m.creatorDid);
				if (creatorUser) {
					creator = {
						did: creatorUser.did,
						handle: creatorUser.handle,
						displayName: creatorUser.displayName,
						avatarUrl: creatorUser.avatarUrl
					};
				}
			}

			// 回答済みタブはPDSのanswerレコードをread-throughで正とする（DBの本文キャッシュは使わない）。
			if (tab === 'answered') {
				const resolved = await resolveAnsweredContent(env, m, cache);
				if (!resolved) return null;
				return {
					...m,
					body: resolved.body,
					answer: resolved.answer,
					imageUrls: resolved.imageUrls,
					sender,
					creator
				};
			}

			return {
				...m,
				body: resolvedQuestion?.body ?? m.body,
				imageUrls: resolvedQuestion?.imageUrls ?? [],
				sender,
				creator
			};
		}));

		return enrichedOrNull.filter((m): m is NonNullable<typeof m> => m !== null);
	})();

	const unreadCount = env ? await countVisibleUnread(env, user.did, cache) : 0;

	return {
		messages,
		unreadCount,
		page,
		tab,
		appUrl: env?.PUBLIC_APP_URL ?? ''
	};
};
