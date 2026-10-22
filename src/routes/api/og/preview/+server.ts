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
	// 1リクエストで生成するのは1枚だけにする(背景ありの描画は重く、2枚まとめるとWorkersのCPU上限を超えやすい)。
	// box/message 両方が必要なクライアントは並列に2リクエスト送る。
	const variant = rawVariant === 'message' ? 'message' : 'box';
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
	const avatarDataUri = variant === 'box' && user.avatarUrl ? await fetchImageAsDataUri(user.avatarUrl) : null;

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
				handle: user.handle,
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
