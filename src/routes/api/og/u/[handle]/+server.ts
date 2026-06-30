import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { getUserByHandle, getUserByDid } from '$lib/server/db.js';
import { resolveHandle } from '$lib/server/atproto.js';
import { ensureInit, loadFonts, fetchImageAsDataUri, satori, Resvg } from '$lib/server/og.js';

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

	const name = creator.displayName?.trim() || creator.handle;
	const boxName = creator.boxName?.trim() || 'めやすばこ';
	const avatarDataUri = creator.avatarUrl ? await fetchImageAsDataUri(creator.avatarUrl) : null;

	const avatarNode = avatarDataUri
		? {
				type: 'img',
				props: {
					src: avatarDataUri,
					width: 140,
					height: 140,
					style: { borderRadius: '50%', objectFit: 'cover' }
				}
			}
		: {
				type: 'div',
				props: {
					style: {
						width: '140px',
						height: '140px',
						borderRadius: '50%',
						background: '#e0f2fe',
						color: '#0284c7',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						fontSize: '56px',
						fontWeight: 700,
						fontFamily: '"Noto Sans JP"'
					},
					children: name[0].toUpperCase()
				}
			};

	const svg = await satori(
		{
			type: 'div',
			props: {
				style: {
					width: '1200px',
					height: '630px',
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between',
					background: '#ffffff',
					padding: '64px',
					fontFamily: '"Noto Sans JP", sans-serif'
				},
				children: [
					{
						type: 'div',
						props: {
							style: {
								fontSize: '52px',
								fontWeight: 700,
								color: '#0369a1',
								fontFamily: '"Noto Sans JP"'
							},
							children: `${name}の${boxName}`
						}
					},
					{
						type: 'div',
						props: {
							style: {
								display: 'flex',
								alignItems: 'center',
								gap: '24px'
							},
							children: [
								avatarNode,
								{
									type: 'div',
									props: {
										style: { display: 'flex', flexDirection: 'column' },
										children: [
											{
												type: 'div',
												props: {
													style: {
														fontSize: '40px',
														fontWeight: 700,
														color: '#0f172a'
													},
													children: name
												}
											},
											{
												type: 'div',
												props: {
													style: {
														fontSize: '24px',
														color: '#64748b',
														marginTop: '8px'
													},
													children: `@${creator.handle}`
												}
											}
										]
									}
								}
							]
						}
					},
					{
						type: 'div',
						props: {
							style: {
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'flex-end',
								gap: '10px'
							},
							children: [
								{
									type: 'div',
									props: {
										style: {
											fontSize: '22px',
											fontWeight: 700,
											color: '#0ea5e9',
											fontFamily: '"KillGothic"'
										},
										children: 'めやすあっと'
									}
								},
								{
									type: 'div',
									props: {
										style: {
											fontSize: '18px',
											color: '#94a3b8',
											fontFamily: '"KillGothic"'
										},
										children: 'meyasuat.suibari.com'
									}
								}
							]
						}
					}
				]
			}
		},
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
