import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { getMessageById, getUserByDid } from '$lib/server/db.js';
import { ensureInit, loadFonts, loadIcon, buildQuestionNode, satori, Resvg, fetchImageAsDataUri } from '$lib/server/og.js';

function buildAvatarNode(dataUri: string | null, label: string, size: number) {
	return dataUri
		? {
				type: 'img',
				props: {
					src: dataUri,
					style: { width: `${size}px`, height: `${size}px`, borderRadius: '50%', objectFit: 'cover' }
				}
			}
		: {
				type: 'div',
				props: {
					style: {
						width: `${size}px`, height: `${size}px`, borderRadius: '50%',
						background: '#334155', color: '#cbd5e1',
						display: 'flex', alignItems: 'center', justifyContent: 'center',
						fontSize: `${Math.round(size / 2)}px`, fontWeight: 'bold'
					},
					children: label[0].toUpperCase()
				}
			};
}

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

	const headerNode = sender
		? {
				type: 'div',
				props: {
					style: { display: 'flex', alignItems: 'center', gap: '12px' },
					children: [
						buildAvatarNode(senderAvatarDataUri, sender.displayName ?? sender.handle, 48),
						{
							type: 'div',
							props: {
								style: { fontSize: '28px', color: '#475569', fontFamily: '"Noto Sans JP"' },
								children: `${((sender.displayName ?? sender.handle).length > 12 ? (sender.displayName ?? sender.handle).slice(0, 12) + '…' : (sender.displayName ?? sender.handle))}さんからのメッセージ`
							}
						}
					]
				}
			}
		: null;

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
					headerNode,
					{
						type: 'div',
						props: {
							style: {
								display: 'flex',
								flex: 1,
								alignItems: 'center',
								justifyContent: 'center',
								overflow: 'hidden'
							},
							children: buildQuestionNode(body, !!sender)
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
										style: { display: 'flex', alignItems: 'center', gap: '16px' },
										children: [
											buildAvatarNode(creatorAvatarDataUri, creatorName, 48),
											{
												type: 'div',
												props: {
													style: {
														fontSize: '24px',
														color: '#64748b',
														fontFamily: '"Noto Sans JP"'
													},
													children: `${creatorName} の ${boxName}`
												}
											}
										]
									}
								},
								{
									type: 'div',
									props: {
										style: { display: 'flex', alignItems: 'center', gap: '12px' },
										children: [
											{ type: 'img', props: { src: icon, width: 52, height: 52 } },
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
																	fontSize: '48px',
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
																	fontSize: '14px',
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
					}
				].filter(Boolean)
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

	const response = new Response(png.buffer as ArrayBuffer, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800, immutable'
		}
	});

	platform.context.waitUntil(edgeCache.put(cacheKey as any, response.clone() as any));
	return response;
};
