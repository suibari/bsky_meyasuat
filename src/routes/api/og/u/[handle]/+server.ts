import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { resolveCreatorByHandle } from '$lib/server/db.js';
import { buildBlobCdnThumbUrl } from '$lib/server/messageImages.js';
import { getOgTheme } from '$lib/theme.js';
import { ensureInit, loadFonts, loadIcon, fetchImageAsDataUri, buildUserOgSvgNode, renderOgPng } from '$lib/server/og.js';

export const GET: RequestHandler = async ({ params, platform, url }) => {
	const env = platform?.env;
	if (!env) error(503, 'Service unavailable');

	const creator = await resolveCreatorByHandle(env, params.handle);
	if (!creator) error(404, 'Not found');

	const appUrl = env.PUBLIC_APP_URL || url.origin;

	await ensureInit();
	const fonts = await loadFonts(appUrl);

	const name = creator.displayName?.trim() || creator.handle;
	const boxName = creator.boxName?.trim() || 'めやすばこ';
	const theme = getOgTheme(creator.colorTheme);
	const [avatarDataUri, backgroundImageDataUri] = await Promise.all([
		creator.avatarUrl ? fetchImageAsDataUri(creator.avatarUrl) : Promise.resolve<string | null>(null),
		creator.backgroundImageCid
			? fetchImageAsDataUri(buildBlobCdnThumbUrl(creator.did, creator.backgroundImageCid))
			: Promise.resolve<string | null>(null)
	]);
	const icon = await loadIcon(appUrl, theme.flat.logoTitle);

	const png = await renderOgPng(
		buildUserOgSvgNode({
			name,
			handle: creator.handle,
			boxName,
			avatarDataUri,
			icon,
			theme,
			backgroundImageDataUri
		}),
		fonts
	);

	return new Response(png.buffer as ArrayBuffer, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
			'Access-Control-Allow-Origin': '*'
		}
	});
};
