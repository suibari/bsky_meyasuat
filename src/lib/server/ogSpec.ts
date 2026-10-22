import { error } from '@sveltejs/kit';
import type { User } from '$lib/server/db.js';
import { getMessageById, getUserByDid, resolveCreatorByHandle } from '$lib/server/db.js';
import { getAnsweredMessageFromPdsById, resolveAnsweredContent, resolveQuestionContent } from '$lib/server/pdsSync.js';
import { buildBlobCdnUrl } from '$lib/server/messageImages.js';
import type { OgSpec } from '$lib/og/core.js';

type Env = App.Platform['env'];

export type ResolvedOgSpec = { creator: User; spec: OgSpec };

function backgroundUrl(creator: User): string | null {
	return creator.backgroundImageCid ? buildBlobCdnUrl(creator.did, creator.backgroundImageCid) : null;
}

export async function resolveBoxOgSpec(env: Env, handle: string): Promise<ResolvedOgSpec> {
	const creator = await resolveCreatorByHandle(env, handle);
	if (!creator) error(404, 'Not found');
	return {
		creator,
		spec: {
			kind: 'box',
			name: creator.displayName?.trim() || creator.handle,
			handle: creator.handle,
			boxName: creator.boxName?.trim() || 'めやすばこ',
			avatarUrl: creator.avatarUrl,
			colorTheme: creator.colorTheme,
			backgroundUrl: backgroundUrl(creator)
		}
	};
}

export async function resolveMessageOgSpec(
	env: Env,
	handle: string,
	messageId: string,
	appUrl: string
): Promise<ResolvedOgSpec> {
	const creator = await resolveCreatorByHandle(env, handle);
	if (!creator) error(404, 'Creator not found');

	let message = await getMessageById(env, messageId);
	if (!message) {
		message = await getAnsweredMessageFromPdsById(env, creator.did, appUrl, messageId);
	}
	if (!message || message.creatorDid !== creator.did) error(404, 'Not found');

	const resolved = message.answerRecordUri
		? await resolveAnsweredContent(env, message)
		: await resolveQuestionContent(message);
	if (!resolved) error(404, 'Not found');

	const sender = message.senderDid ? await getUserByDid(env, message.senderDid) : null;

	const bodyLimit = sender ? 150 : 190;
	const body = resolved.body.length > bodyLimit ? resolved.body.slice(0, bodyLimit) + '…' : resolved.body;

	return {
		creator,
		spec: {
			kind: 'message',
			body,
			sender: sender ? { displayName: sender.displayName, handle: sender.handle, avatarUrl: sender.avatarUrl } : null,
			creatorName: creator.displayName?.trim() || creator.handle || 'unknown',
			boxName: creator.boxName?.trim() || 'めやすばこ',
			creatorAvatarUrl: creator.avatarUrl,
			colorTheme: creator.colorTheme,
			backgroundUrl: backgroundUrl(creator)
		}
	};
}
