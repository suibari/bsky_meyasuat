import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { getUserByHandle, getUserByDid } from '$lib/server/db.js';
import { resolveHandle } from '$lib/server/atproto.js';
import { ensureInit, loadFonts, loadIcon, fetchImageAsDataUri, buildUserOgSvgNode, satori, Resvg } from '$lib/server/og.js';

export const GET: RequestHandler = async ({ params, platform, url }) => {
	const env = platform?.env;
	if (!env) error(503, 'Service unavailable');

	const handle = params.handle.replace(/^@/, '');
	let creator = await getUserByHandle(env, handle);
	if (!creator) {
		const resolved = await resolveHandle(handle);
		if (resolved) creator = await getUserByDid(env, resolved.did);
	}
	if (!creator) error(404, 'Not found');

	const appUrl = env.PUBLIC_APP_URL || url.origin;

	await ensureInit();
	const fonts = await loadFonts(appUrl);
	const icon = await loadIcon(appUrl);

	const name = creator.displayName?.trim() || creator.handle;
	const boxName = creator.boxName?.trim() || 'めやすばこ';
	const avatarDataUri = creator.avatarUrl ? await fetchImageAsDataUri(creator.avatarUrl) : null;

	const svg = await satori(
		buildUserOgSvgNode({
			name,
			handle: creator.handle,
			boxName,
			avatarDataUri,
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

	return new Response(png.buffer as ArrayBuffer, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
		}
	});
};
