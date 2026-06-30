import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { getMessageById, getUserByDid } from '$lib/server/db.js';
import { ensureInit, loadFonts, buildQuestionNode, satori, Resvg, fetchImageAsDataUri } from '$lib/server/og.js';

export const GET: RequestHandler = async ({ params, platform, url }) => {
	const env = platform?.env;
	if (!env) error(503, 'Service unavailable');

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

	const body =
		message.body.length > 140 ? message.body.slice(0, 140) + '…' : message.body;
	const handle = creator?.handle ?? 'unknown';
	const boxName = creator?.boxName?.trim() || 'めやすばこ';

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
								display: 'flex',
								flex: 1,
								alignItems: 'center',
								justifyContent: 'center'
							},
							children: buildQuestionNode(body)
						}
					},
					{
						type: 'div',
						props: {
							style: {
								display: 'flex',
								alignItems: 'flex-end',
								justifyContent: 'space-between'
							},
							children: [
								{
									type: 'div',
									props: {
										style: {
											display: 'flex',
											flexDirection: 'column',
											gap: '8px'
										},
										children: [
											sender ? {
												type: 'div',
												props: {
													style: { display: 'flex', alignItems: 'center', gap: '12px' },
													children: [
														sender.avatarUrl ? {
															type: 'img',
															props: {
																src: await fetchImageAsDataUri(sender.avatarUrl),
																style: { width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }
															}
														} : {
															type: 'div',
															props: {
																style: {
																	width: '48px', height: '48px', borderRadius: '50%',
																	background: '#334155', color: '#cbd5e1',
																	display: 'flex', alignItems: 'center', justifyContent: 'center',
																	fontSize: '24px', fontWeight: 'bold'
																},
																children: (sender.displayName ?? sender.handle)[0].toUpperCase()
															}
														},
														{
															type: 'div',
															props: {
																style: { fontSize: '24px', color: '#cbd5e1', fontFamily: '"Noto Sans JP"' },
																children: ((sender.displayName ?? sender.handle).length > 12 ? (sender.displayName ?? sender.handle).slice(0, 12) + '…' : (sender.displayName ?? sender.handle))
															}
														}
													]
												}
											} : null,
											{
												type: 'div',
												props: {
													style: {
														fontSize: '22px',
														color: '#64748b',
														fontFamily: '"Noto Sans JP"'
													},
													children: `@${handle} への${boxName}`
												}
											}
										].filter(Boolean)
									}
								},
								{
									type: 'div',
									props: {
										style: {
											display: 'flex',
											flexDirection: 'column',
											alignItems: 'flex-end',
											gap: '4px'
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
														fontSize: '16px',
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
