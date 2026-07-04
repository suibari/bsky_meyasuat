import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { getMessageById, getUserByDid, resolveCreatorByHandle } from '$lib/server/db.js';
import { getAnsweredMessageFromPdsById, resolveAnsweredContent, resolveQuestionContent } from '$lib/server/pdsSync.js';
import { buildBlobCdnUrl } from '$lib/server/messageImages.js';
import { getOgTheme } from '$lib/theme.js';
import {
	ensureInit,
	loadFonts,
	loadIcon,
	buildMessageOgSvgNode,
	renderOgPng,
	fetchImageAsDataUri
} from '$lib/server/og.js';

export const GET: RequestHandler = async ({ params, platform, url }) => {
	const env = platform?.env;
	if (!env) error(503, 'Service unavailable');
	const edgeCache = platform.caches.default;
	const cacheKey = url.toString();
	const cached = await edgeCache.match(cacheKey as any);
	if (cached) {
		return cached as unknown as Response;
	}

	const creator = await resolveCreatorByHandle(env, params.handle);
	if (!creator) error(404, 'Creator not found');

	const appUrl = env.PUBLIC_APP_URL || url.origin;
	let message = await getMessageById(env, params.messageId);
	if (!message) {
		message = await getAnsweredMessageFromPdsById(env, creator.did, appUrl, params.messageId);
	}
	if (!message || message.creatorDid !== creator.did) error(404, 'Not found');

	const resolved = message.answerRecordUri
		? await resolveAnsweredContent(env, message)
		: await resolveQuestionContent(message);
	if (!resolved) error(404, 'Not found');

	let sender = null;
	if (message.senderDid) {
		sender = await getUserByDid(env, message.senderDid);
	}

	await ensureInit();
	const fonts = await loadFonts(appUrl);
	const icon = await loadIcon(appUrl);

	const bodyLimit = sender ? 150 : 190;
	const body =
		resolved.body.length > bodyLimit ? resolved.body.slice(0, bodyLimit) + '…' : resolved.body;
	const creatorName = creator.displayName?.trim() || creator.handle || 'unknown';
	const boxName = creator.boxName?.trim() || 'めやすばこ';

	const theme = getOgTheme(creator.colorTheme);
	const [senderAvatarDataUri, creatorAvatarDataUri, backgroundImageDataUri] = await Promise.all([
		sender?.avatarUrl ? fetchImageAsDataUri(sender.avatarUrl) : Promise.resolve<string | null>(null),
		creator.avatarUrl ? fetchImageAsDataUri(creator.avatarUrl) : Promise.resolve<string | null>(null),
		creator.backgroundImageCid
			? fetchImageAsDataUri(buildBlobCdnUrl(creator.did, creator.backgroundImageCid))
			: Promise.resolve<string | null>(null)
	]);

	const png = await renderOgPng(
		buildMessageOgSvgNode({
			body,
			sender,
			creatorName,
			boxName,
			senderAvatarDataUri,
			creatorAvatarDataUri,
			icon,
			theme,
			backgroundImageDataUri
		}),
		fonts
	);

	const response = new Response(png.buffer as ArrayBuffer, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800, immutable'
		}
	});

	platform.context.waitUntil(edgeCache.put(cacheKey as any, response.clone() as any));
	return response;
};
