import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getMessageById, getUserByDid } from '$lib/server/db.js';
import { getAnsweredMessagesFromPds, isQuestionVisibleFromPds, reconcileMessageWithPds, resolveAnsweredContent, resolveQuestionContent } from '$lib/server/pdsSync.js';
import { resolveMessageImageUrls } from '$lib/server/messageImages.js';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	const env = platform?.env;
	const ctx = platform?.context;
	if (!env) error(503, 'Service unavailable');

	let message = await getMessageById(env, params.messageId);
	if (!message) error(404, 'Message not found');

	const syncTask = reconcileMessageWithPds(env, message);
	if (ctx) {
		ctx.waitUntil(syncTask);
	} else {
		void syncTask.catch(() => {});
	}

	// 回答済みならPDSのanswerレコードをread-throughで正とする。フレッシュな取り下げ・
	// 回答削除の検知もここで行われる（nullなら表示すべき内容が無い＝404）。
	let resolvedContent: { body: string; answer: string; imageUrls: string[] } | null = null;
	let resolvedQuestion: { body: string; imageUrls: string[]; senderDid: string | null } | null = null;
	if (message.answerRecordUri) {
		resolvedContent = await resolveAnsweredContent(env, message);
		if (!resolvedContent) error(404, 'Message not found');
	} else if (!(await isQuestionVisibleFromPds(message))) {
		error(404, 'Message not found');
	} else {
		resolvedQuestion = await resolveQuestionContent(message);
		if (!resolvedQuestion) error(404, 'Message not found');
	}

	const creator = await getUserByDid(env, message.creatorDid);
	if (!creator) error(404, 'Creator not found');

	const requestedHandle = params.handle.replace(/^@/, '');
	if (requestedHandle !== creator.handle) {
		redirect(301, `/u/${creator.handle}/m/${message.id}`);
	}

	let senderProfile = null;
	const senderDid = message.senderDid ?? resolvedQuestion?.senderDid ?? null;
	if (senderDid) {
		const sender = await getUserByDid(env, senderDid);
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

	const relatedQA = await getAnsweredMessagesFromPds(env, message.creatorDid, appUrl, {
		limit: 10,
		excludeId: message.id
	});

	const imageUrls = resolvedContent
		? resolvedContent.imageUrls
		: resolvedQuestion?.imageUrls ?? await resolveMessageImageUrls(env, message);

	return {
		message: {
			...message,
			body: resolvedContent?.body ?? resolvedQuestion?.body ?? message.body,
			answer: resolvedContent?.answer ?? message.answer,
			imageUrls,
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
		relatedQA: (await Promise.all(relatedQA.map(async (m) => {
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
	};
};
