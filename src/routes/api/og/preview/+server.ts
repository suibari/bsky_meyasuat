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
	fetchImageAsDataUri,
	bytesToBase64
} from '$lib/server/og.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE = 1024 * 1024; // 1MB
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1分
const RATE_LIMIT_MAX = 120;

async function fileToDataUri(file: File): Promise<string> {
	const buf = new Uint8Array(await file.arrayBuffer());
	return `data:${file.type};base64,${bytesToBase64(buf)}`;
}

function pngToDataUri(png: Uint8Array): string {
	return `data:image/png;base64,${bytesToBase64(png)}`;
}

export const POST: RequestHandler = async ({ request, platform, locals, url }) => {
	const env = platform?.env;
	if (!env || !locals.user) error(401, 'Unauthorized');
	const user = locals.user;

	const allowed = await checkRateLimit(env, `preview:${user.did}`, user.did, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX);
	if (!allowed) error(429, 'Rate limit exceeded');
	await logRateLimit(env, `preview:${user.did}`, user.did);

	const fd = await request.formData();
	const colorTheme = (fd.get('colorTheme') as string | null) ?? null;
	const rawVariant = fd.get('variant');
	const variant = rawVariant === 'message' || rawVariant === 'both' ? rawVariant : 'box';
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
	const icon = await loadIcon(appUrl, theme.flat.logoTitle);

	const name = user.displayName?.trim() || user.handle;
	const boxName = user.boxName?.trim() || 'めやすばこ';
	const avatarDataUri = user.avatarUrl ? await fetchImageAsDataUri(user.avatarUrl) : null;

	const buildNode = (target: 'box' | 'message') =>
		target === 'message'
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
				handle: user.handle,
				boxName,
				avatarDataUri,
				icon,
				theme,
				backgroundImageDataUri
			});

	if (variant === 'both') {
		const [boxPng, messagePng] = await Promise.all([
			renderOgPng(buildNode('box'), fonts),
			renderOgPng(buildNode('message'), fonts)
		]);

		return new Response(JSON.stringify({
			box: pngToDataUri(boxPng),
			message: pngToDataUri(messagePng)
		}), {
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store'
			}
		});
	}

	const png = await renderOgPng(buildNode(variant), fonts);

	return new Response(png.buffer as ArrayBuffer, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'no-store'
		}
	});
};
