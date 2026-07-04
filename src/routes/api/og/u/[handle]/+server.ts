import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { resolveCreatorByHandle } from '$lib/server/db.js';
import { ensureInit, loadFonts, loadIcon, fetchImageAsDataUri, buildUserOgSvgNode, renderOgPng } from '$lib/server/og.js';

export const GET: RequestHandler = async ({ params, platform, url }) => {
	const env = platform?.env;
	if (!env) error(503, 'Service unavailable');

	const creator = await resolveCreatorByHandle(env, params.handle);
	if (!creator) error(404, 'Not found');

	const appUrl = env.PUBLIC_APP_URL || url.origin;

	await ensureInit();
	const fonts = await loadFonts(appUrl);
	const icon = await loadIcon(appUrl);

	const name = creator.displayName?.trim() || creator.handle;
	const boxName = creator.boxName?.trim() || 'めやすばこ';
	const avatarDataUri = creator.avatarUrl ? await fetchImageAsDataUri(creator.avatarUrl) : null;

	const png = await renderOgPng(
		buildUserOgSvgNode({
			name,
			handle: creator.handle,
			boxName,
			avatarDataUri,
			icon
		}),
		fonts
	);

	return new Response(png.buffer as ArrayBuffer, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
		}
	});
};
