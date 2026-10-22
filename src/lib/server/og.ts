import { initSatori, initResvg } from '$lib/og/core.js';

export * from '$lib/og/core.js';

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
