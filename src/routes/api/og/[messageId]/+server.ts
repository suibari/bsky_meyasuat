import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { getMessageById, getUserByDid } from '$lib/server/db.js';
import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';

let wasmReady = false;

async function ensureWasm(appUrl: string): Promise<void> {
	if (wasmReady) return;
	const res = await fetch(`${appUrl}/resvg.wasm`);
	await initWasm(res);
	wasmReady = true;
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

	await ensureWasm(appUrl);

	// フォントを取得
	const fontRes = await fetch(`${appUrl}/fonts/NotoSansJP-subset.woff2`);
	const fontData = fontRes.ok ? await fontRes.arrayBuffer() : new ArrayBuffer(0);

	const body =
		message.body.length > 140 ? message.body.slice(0, 140) + '…' : message.body;
	const handle = creator?.handle ?? 'unknown';

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
								wordBreak: 'break-all'
							},
							children: body
						}
					},
					{
						type: 'div',
						props: {
							style: { fontSize: '22px', color: '#a5b4fc', marginTop: '48px' },
							children: `@${handle} へのめやすあっと`
						}
					},
					{
						type: 'div',
						props: {
							style: {
								fontSize: '16px',
								color: '#6366f1',
								marginTop: '12px',
								letterSpacing: '0.05em'
							},
							children: 'meyasuat.pages.dev'
						}
					}
				]
			}
		},
		{
			width: 1200,
			height: 630,
			fonts: fontData.byteLength > 0
				? [{ name: 'Noto Sans JP', data: fontData, weight: 400, style: 'normal' }]
				: []
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
