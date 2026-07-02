import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { getMessageById, getUserByDid } from '$lib/server/db.js';
import {
	ensureInit,
	loadFonts,
	loadIcon,
	buildMessageOgSvgNode,
	satori,
	Resvg,
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

	const [message, appUrl] = [
		await getMessageById(env, params.messageId),
		env.PUBLIC_APP_URL || url.origin
	];
	if (!message) error(404, 'Not found');

	const creator = await getUserByDid(env, message.creatorDid);

	let sender = null;
	if (message.senderDid) {
		sender = await getUserByDid(env, message.senderDid);
	}

	await ensureInit();
	const fonts = await loadFonts(appUrl);
	const icon = await loadIcon(appUrl);

	// 記名メッセージは上段に送信者バッジが入り使えるスペースが狭くなるため、
	// 質問文の最大長を短くしてフォントが小さくなりすぎないようにする
	const bodyLimit = sender ? 110 : 140;
	const body =
		message.body.length > bodyLimit ? message.body.slice(0, bodyLimit) + '…' : message.body;
	const creatorName = creator?.displayName?.trim() || creator?.handle || 'unknown';
	const boxName = creator?.boxName?.trim() || 'めやすばこ';

	const [senderAvatarDataUri, creatorAvatarDataUri] = await Promise.all([
		sender?.avatarUrl ? fetchImageAsDataUri(sender.avatarUrl) : Promise.resolve<string | null>(null),
		creator?.avatarUrl ? fetchImageAsDataUri(creator.avatarUrl) : Promise.resolve<string | null>(null)
	]);

	const svg = await satori(
		buildMessageOgSvgNode({
			body,
			sender,
			creatorName,
			boxName,
			senderAvatarDataUri,
			creatorAvatarDataUri,
			icon
		}),
		{
			width: 1200,
			height: 630,
			fonts: [
				{ name: 'Noto Sans JP', data: fonts.noto, weight: 400, style: 'normal' },
				{ name: 'KillGothic', data: fonts.kill, weight: 400, style: 'normal' }
			]
		}
	);

	const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
	const rendered = resvg.render();
	const png = rendered.asPng();

	const response = new Response(png.buffer as ArrayBuffer, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800, immutable'
		}
	});

	platform.context.waitUntil(edgeCache.put(cacheKey as any, response.clone() as any));
	return response;
};
