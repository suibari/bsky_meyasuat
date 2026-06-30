import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { getMessageById, getUserByDid } from '$lib/server/db.js';
import satori, { init as initSatori } from 'satori/standalone';
import { Resvg, initWasm as initResvg } from '@resvg/resvg-wasm';

let initialized = false;

// 本番(Cloudflare)では _worker.js に注入された事前コンパイル済みの
// WebAssembly.Module を globalThis 経由で受け取る。dev(Node)では
// node:fs から bytes を読んで初期化する(本番ビルドでは import.meta.env.DEV が
// false に置換され、この分岐ごと dead-code 除去される)。
async function ensureInit(): Promise<void> {
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

async function loadFonts(appUrl: string): Promise<{ noto: ArrayBuffer; kill: ArrayBuffer }> {
	if (fontCache) return fontCache;
	const [noto, kill] = await Promise.all([
		fetch(`${appUrl}/fonts/NotoSansJP-Regular.ttf`).then((r) => r.arrayBuffer()),
		fetch(`${appUrl}/fonts/GN-KillGothic-U-KanaNA.ttf`).then((r) => r.arrayBuffer())
	]);
	fontCache = { noto, kill };
	return fontCache;
}

export const GET: RequestHandler = async ({ params, platform, url }) => {
	const env = platform?.env;
	if (!env) error(503, 'Service unavailable');

	const [message, appUrl] = [
		await getMessageById(env, params.messageId),
		env.PUBLIC_APP_URL || url.origin
	];
	if (!message) error(404, 'Not found');

	const creator = await getUserByDid(env, message.creatorDid);

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
					alignItems: 'center',
					justifyContent: 'center',
					background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
					padding: '80px',
					fontFamily: '"Noto Sans JP", sans-serif'
				},
				children: [
					{
						type: 'div',
						props: {
							style: {
								fontSize: body.length > 60 ? '32px' : '40px',
								color: '#f1f5f9',
								lineHeight: 1.7,
								maxWidth: '1000px',
								textAlign: 'center',
								wordBreak: 'break-all',
								fontFamily: '"Noto Sans JP"'
							},
							children: body
						}
					},
					{
						type: 'div',
						props: {
							style: {
								fontSize: '22px',
								color: '#a5b4fc',
								marginTop: '48px',
								fontFamily: '"KillGothic"'
							},
							children: `@${handle} への${boxName}`
						}
					},
					{
						type: 'div',
						props: {
							style: {
								fontSize: '16px',
								color: '#6366f1',
								marginTop: '12px',
								letterSpacing: '0.05em',
								fontFamily: '"KillGothic"'
							},
							children: 'meyasuat.suibari.com'
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
