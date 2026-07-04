import satori, { init as initSatori } from 'satori/standalone';
import { Resvg, initWasm as initResvg } from '@resvg/resvg-wasm';

let initialized = false;

// 本番(Cloudflare)では _worker.js に注入された事前コンパイル済みの
// WebAssembly.Module を globalThis 経由で受け取る。dev(Node)では
// node:fs から bytes を読んで初期化する(本番ビルドでは import.meta.env.DEV が
// false に置換され、この分岐ごと dead-code 除去される)。
export async function ensureInit(): Promise<void> {
	if (initialized) return;
	let resvgInput: any = (globalThis as any).__OG_RESVG_WASM;
	let yogaInput: any = (globalThis as any).__OG_YOGA_WASM;
	if (import.meta.env.DEV) {
		const { readFile } = await import('node:fs/promises');
		const { createRequire } = await import('node:module');
		const req = createRequire(import.meta.url);
		resvgInput = await readFile(req.resolve('@resvg/resvg-wasm/index_bg.wasm'));
		yogaInput = await readFile(req.resolve('satori/yoga.wasm'));
	}
	await initResvg(resvgInput);
	await initSatori(yogaInput);
	initialized = true;
}

let fontCache: { noto: ArrayBuffer; kill: ArrayBuffer } | null = null;

export async function loadFonts(appUrl: string): Promise<{ noto: ArrayBuffer; kill: ArrayBuffer }> {
	if (fontCache) return fontCache;
	const [noto, kill] = await Promise.all([
		fetch(`${appUrl}/fonts/NotoSansJP-Regular.ttf`).then((r) => r.arrayBuffer()),
		fetch(`${appUrl}/fonts/GN-KillGothic-U-KanaNA.ttf`).then((r) => r.arrayBuffer())
	]);
	fontCache = { noto, kill };
	return fontCache;
}

let iconCache: string | null = null;

function truncateText(text: string, maxLength: number, ellipsis = '...'): string {
	return text.length > maxLength ? `${text.slice(0, maxLength)}${ellipsis}` : text;
}

export async function loadIcon(appUrl: string): Promise<string> {
	if (iconCache) return iconCache;
	const res = await fetch(`${appUrl}/icon_meyasuat_cyan.png`);
	const bytes = new Uint8Array(await res.arrayBuffer());
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
	iconCache = `data:image/png;base64,${btoa(binary)}`;
	return iconCache;
}

export async function fetchImageAsDataUri(url: string, timeoutMs = 1200): Promise<string | null> {
	const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
	const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
	try {
		// satori は WebP をデコードできないため、Bluesky CDN の画像は @jpeg を付けて取得する
		const fetchUrl = url.includes('cdn.bsky.app') ? `${url}@jpeg` : url;
		const res = await fetch(fetchUrl, controller ? { signal: controller.signal } : undefined);
		if (!res.ok) return null;
		const contentType = res.headers.get('content-type') || 'image/jpeg';
		const bytes = new Uint8Array(await res.arrayBuffer());
		let binary = '';
		for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
		return `data:${contentType};base64,${btoa(binary)}`;
	} catch {
		return null;
	} finally {
		if (timeoutId !== null) clearTimeout(timeoutId);
	}
}

export function buildAvatarNode(
	dataUri: string | null,
	label: string,
	size: number,
	colors: { background: string; color: string } = { background: '#334155', color: '#cbd5e1' },
	fontSize: number = Math.round(size / 2)
) {
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
						width: `${size}px`,
						height: `${size}px`,
						borderRadius: '50%',
						background: colors.background,
						color: colors.color,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						fontSize: `${fontSize}px`,
						fontWeight: 700,
						fontFamily: '"Noto Sans JP"'
					},
					children: label[0].toUpperCase()
				}
			};
}

export function buildQuestionNode(body: string, hasHeader = false) {
	const len = body.length;
	const fontSize = hasHeader
		? (len <= 30 ? 56 : len <= 60 ? 40 : len <= 100 ? 32 : 30)
		: (len <= 30 ? 64 : len <= 60 ? 48 : len <= 100 ? 36 : 28);
	return {
		type: 'div',
		props: {
			style: {
				display: 'flex',
				fontSize: `${fontSize}px`,
				fontWeight: 400,
				color: '#0f172a',
				lineHeight: 1.5,
				maxWidth: '1000px',
				textAlign: 'center',
				wordBreak: 'break-all',
				fontFamily: '"Noto Sans JP"'
			},
			children: body
		}
	};
}

export function buildLogoNode(
	icon: string,
	opts: {
		iconSize: number;
		titleFontSize: number;
		domainFontSize: number;
		gap?: number;
		innerGap?: number;
	}
) {
	const { iconSize, titleFontSize, domainFontSize, gap = 16, innerGap = 8 } = opts;
	return {
		type: 'div',
		props: {
			style: { display: 'flex', alignItems: 'center', gap: `${gap}px`, flexShrink: 0 },
			children: [
				{ type: 'img', props: { src: icon, width: iconSize, height: iconSize } },
				{
					type: 'div',
					props: {
						style: {
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'flex-end',
							gap: `${innerGap}px`
						},
						children: [
							{
								type: 'div',
								props: {
									style: {
										fontSize: `${titleFontSize}px`,
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
										fontSize: `${domainFontSize}px`,
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
	};
}

export function buildMessageOgSvgNode({
	body,
	sender,
	creatorName,
	boxName,
	senderAvatarDataUri,
	creatorAvatarDataUri,
	icon
}: {
	body: string;
	sender: { displayName: string | null; handle: string } | null;
	creatorName: string;
	boxName: string;
	senderAvatarDataUri: string | null;
	creatorAvatarDataUri: string | null;
	icon: string;
}) {
	const displayCreatorName = truncateText(creatorName, 18);
	const displayBoxName = truncateText(boxName, 14);
	const senderName = sender ? (sender.displayName ?? sender.handle) : null;
	const headerNode = sender
		? {
				type: 'div',
				props: {
					style: { display: 'flex', alignItems: 'center', gap: '12px' },
					children: [
						buildAvatarNode(senderAvatarDataUri, senderName!, 48),
						{
							type: 'div',
							props: {
								style: { fontSize: '28px', color: '#475569', fontFamily: '"Noto Sans JP"' },
								children: `${truncateText(senderName!, 12, '…')}さんからのメッセージ`
							}
						}
					]
				}
			}
		: null;

	return {
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
									style: {
										display: 'flex',
										alignItems: 'center',
										gap: '16px',
										width: '620px',
										flexShrink: 1
									},
									children: [
										buildAvatarNode(creatorAvatarDataUri, creatorName, 48),
										{
											type: 'div',
											props: {
												style: {
													fontSize: '24px',
													color: '#64748b',
													fontFamily: '"KillGothic"',
													flexShrink: 1,
													whiteSpace: 'nowrap',
													overflow: 'hidden',
													textOverflow: 'ellipsis'
												},
												children: `${displayCreatorName} の ${displayBoxName}`
											}
										}
									]
								}
							},
							buildLogoNode(icon, {
								iconSize: 52,
								titleFontSize: 48,
								domainFontSize: 14,
								gap: 12,
								innerGap: 4
							})
						]
					}
				}
			].filter(Boolean)
		}
	};
}

export function buildUserOgSvgNode({
	name,
	handle,
	boxName,
	avatarDataUri,
	icon
}: {
	name: string;
	handle: string;
	boxName: string;
	avatarDataUri: string | null;
	icon: string;
}) {
	const displayName = truncateText(name, 16);
	const displayHandle = truncateText(handle, 30);
	const displayBoxName = truncateText(boxName, 14);
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
		: buildAvatarNode(null, name, 140, { background: '#e0f2fe', color: '#0284c7' }, 56);

	return {
		type: 'div',
		props: {
			style: {
				width: '1200px',
				height: '630px',
				display: 'flex',
				flexDirection: 'column',
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
							fontFamily: '"KillGothic"',
							maxWidth: '1072px',
							whiteSpace: 'nowrap',
							overflow: 'hidden',
							textOverflow: 'ellipsis'
						},
						children: `${displayName} の ${displayBoxName}`
					}
				},
				{
					type: 'div',
					props: {
						style: {
							display: 'flex',
							flexGrow: 1,
							alignItems: 'center',
							justifyContent: 'center',
							fontSize: '80px',
							fontWeight: 400,
							color: '#0f172a'
						},
						children: 'メッセージを募集中'
					}
				},
				{
					type: 'div',
					props: {
						style: {
							display: 'flex',
							alignItems: 'flex-end',
							justifyContent: 'space-between',
							width: '100%'
						},
						children: [
							{
								type: 'div',
								props: {
									style: {
										display: 'flex',
										alignItems: 'center',
										gap: '24px',
										width: '620px',
										flexShrink: 1
									},
									children: [
										avatarNode,
										{
											type: 'div',
											props: {
												style: { display: 'flex', flexDirection: 'column', flexShrink: 1 },
												children: [
													{
														type: 'div',
														props: {
															style: {
																fontSize: '40px',
																fontWeight: 700,
																color: '#0f172a',
																flexShrink: 1
															},
															children: displayName
														}
													},
													{
														type: 'div',
														props: {
															style: {
																fontSize: '24px',
																color: '#64748b',
																marginTop: '8px',
																flexShrink: 1
															},
															children: `@${displayHandle}`
														}
													}
												]
											}
										}
									]
								}
							},
							buildLogoNode(icon, { iconSize: 72, titleFontSize: 64, domainFontSize: 18 })
						]
					}
				}
			]
		}
	};
}

export async function renderOgPng(
	node: Parameters<typeof satori>[0],
	fonts: { noto: ArrayBuffer; kill: ArrayBuffer }
): Promise<Uint8Array> {
	const svg = await satori(node, {
		width: 1200,
		height: 630,
		fonts: [
			{ name: 'Noto Sans JP', data: fonts.noto, weight: 400, style: 'normal' },
			{ name: 'KillGothic', data: fonts.kill, weight: 400, style: 'normal' }
		]
	});
	const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
	return resvg.render().asPng();
}

export { satori, Resvg };
