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
		? (len <= 30 ? 56 : len <= 60 ? 40 : len <= 100 ? 32 : 24)
		: (len <= 30 ? 64 : len <= 60 ? 48 : len <= 100 ? 36 : 28);
	const emphasize = len > 60;
	return {
		type: 'div',
		props: {
			style: {
				display: 'flex',
				fontSize: `${fontSize}px`,
				fontWeight: emphasize ? 700 : 400,
				color: emphasize ? '#0369a1' : '#0f172a',
				lineHeight: 1.5,
				maxWidth: '1000px',
				textAlign: 'center',
				wordBreak: 'break-all',
				fontFamily: '"Noto Sans JP"',
				...(emphasize
					? { background: '#e0f2fe', padding: '24px 32px', borderRadius: '24px' }
					: {})
			},
			children: body
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
							fontFamily: '"KillGothic"'
						},
						children: `${name} の ${boxName}`
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
															children: `@${handle}`
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
									style: { display: 'flex', alignItems: 'center', gap: '16px' },
									children: [
										{ type: 'img', props: { src: icon, width: 72, height: 72 } },
										{
											type: 'div',
											props: {
												style: {
													display: 'flex',
													flexDirection: 'column',
													alignItems: 'flex-end',
													gap: '8px'
												},
												children: [
													{
														type: 'div',
														props: {
															style: {
																fontSize: '64px',
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
							}
						]
					}
				}
			]
		}
	};
}

export { satori, Resvg };
