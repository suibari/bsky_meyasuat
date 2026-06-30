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

export async function fetchImageAsDataUri(url: string): Promise<string | null> {
	try {
		// satori は WebP をデコードできないため、Bluesky CDN の画像は @jpeg を付けて取得する
		const fetchUrl = url.includes('cdn.bsky.app') ? `${url}@jpeg` : url;
		const res = await fetch(fetchUrl);
		if (!res.ok) return null;
		const contentType = res.headers.get('content-type') || 'image/jpeg';
		const bytes = new Uint8Array(await res.arrayBuffer());
		let binary = '';
		for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
		return `data:${contentType};base64,${btoa(binary)}`;
	} catch {
		return null;
	}
}

export { satori, Resvg };
