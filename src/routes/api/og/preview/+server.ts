import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { checkRateLimit, logRateLimit } from '$lib/server/db.js';
import { getOgTheme } from '$lib/theme.js';
import {
	ensureInit,
	loadFonts,
	loadIcon,
	buildUserOgSvgNode,
	buildMessageOgSvgNode,
	renderOgPng,
	fetchImageAsDataUri
} from '$lib/server/og.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE = 1024 * 1024; // 1MB
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1分
const RATE_LIMIT_MAX = 20;

async function fileToDataUri(file: File): Promise<string> {
	const buf = new Uint8Array(await file.arrayBuffer());
	let binary = '';
	for (let i = 0; i < buf.byteLength; i++) binary += String.fromCharCode(buf[i]);
	return `data:${file.type};base64,${btoa(binary)}`;
}

export const POST: RequestHandler = async ({ request, platform, locals, url }) => {
	const env = platform?.env;
	if (!env || !locals.user) error(401, 'Unauthorized');

	const allowed = await checkRateLimit(env, `preview:${locals.user.did}`, locals.user.did, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX);
	if (!allowed) error(429, 'Rate limit exceeded');
	await logRateLimit(env, `preview:${locals.user.did}`, locals.user.did);

	const fd = await request.formData();
	const colorTheme = (fd.get('colorTheme') as string | null) ?? null;
	const variant = fd.get('variant') === 'message' ? 'message' : 'box';
	const backgroundFile = fd.get('background');

	let backgroundImageDataUri: string | null = null;
	if (backgroundFile instanceof File && backgroundFile.size > 0) {
		if (!ALLOWED_MIME.has(backgroundFile.type)) error(400, `Invalid image type: ${backgroundFile.type}`);
		if (backgroundFile.size > MAX_IMAGE_SIZE) error(400, 'Image too large');
		backgroundImageDataUri = await fileToDataUri(backgroundFile);
	}

	const theme = getOgTheme(colorTheme);
	const appUrl = env.PUBLIC_APP_URL || url.origin;

	await ensureInit();
	const fonts = await loadFonts(appUrl);
	const icon = await loadIcon(appUrl);

	const name = locals.user.displayName?.trim() || locals.user.handle;
	const boxName = locals.user.boxName?.trim() || 'めやすばこ';
	const avatarDataUri = locals.user.avatarUrl ? await fetchImageAsDataUri(locals.user.avatarUrl) : null;

	const node =
		variant === 'message'
			? buildMessageOgSvgNode({
					body: 'これはプレビュー用のサンプル質問文です。',
					sender: null,
					creatorName: name,
					boxName,
					senderAvatarDataUri: null,
					creatorAvatarDataUri: null,
					icon,
					theme,
					backgroundImageDataUri
				})
			: buildUserOgSvgNode({
					name,
					handle: locals.user.handle,
					boxName,
					avatarDataUri,
					icon,
					theme,
					backgroundImageDataUri
				});

	const png = await renderOgPng(node, fonts);

	return new Response(png.buffer as ArrayBuffer, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'no-store'
		}
	});
};
