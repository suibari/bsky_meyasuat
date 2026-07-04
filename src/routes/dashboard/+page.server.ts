import type { PageServerLoad } from './$types';
import type { Message } from '$lib/server/db.js';
import { getMessages, getUserByDid } from '$lib/server/db.js';
import {
	countVisibleUnread,
	filterMessagesByLiveQuestion,
	getAnsweredMessagesFromPds,
	getSentMessagesFromPds,
	ingestCreatesFromPdsForUser,
	reconcileMessagesWithPds,
	resolveAnsweredContent,
	resolveQuestionContent
} from '$lib/server/pdsSync.js';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	const env = platform?.env;
	const ctx = platform?.context;
	const user = locals.user;
	// Cookie 未送信などで user が無い場合は 500 にせず空で返す（layout が / へリダイレクト）
	if (!user) {
		return { messages: [], unreadCount: 0, page: 0, tab: 'unread', appUrl: env?.PUBLIC_APP_URL ?? '' };
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

	const loadMessages = async () => {
		if (!env) return [[] as Message[], 0] as const;

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
		const messages = tab === 'answered'
			? rawMessages
			: await filterMessagesByLiveQuestion(rawMessages);
		const unreadCount = await countVisibleUnread(env, user.did);
		return [messages, unreadCount] as const;
	};

	const [messages, unreadCount] = await loadMessages();
	if (env) {
		const syncTask = (async () => {
			await ingestCreatesFromPdsForUser(env, user.did, env.PUBLIC_APP_URL ?? '');
			if (messages.length > 0) {
				await reconcileMessagesWithPds(env, messages);
			}
		})();
		if (ctx) {
			ctx.waitUntil(syncTask);
		} else {
			void syncTask.catch(() => {});
		}
	}

	const enrichedOrNull = await Promise.all(messages.map(async (m) => {
		let sender = null;
		let resolvedQuestion = null;
		if (tab !== 'answered') {
			resolvedQuestion = await resolveQuestionContent(m);
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
			if (!env) return null;
			const resolved = await resolveAnsweredContent(env, m);
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
	const enriched = enrichedOrNull.filter((m): m is NonNullable<typeof m> => m !== null);

	return {
		messages: enriched,
		unreadCount,
		page,
		tab,
		appUrl: env?.PUBLIC_APP_URL ?? ''
	};
};
