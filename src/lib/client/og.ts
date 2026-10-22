// ブラウザでOGP画像を描画する。WorkersのFreeプランではサーバー側の描画(背景入りで100ms超)が
// CPU上限(10ms)を超えるため、プレビュー・保存用の画像はすべてここで生成する。
import yogaWasmUrl from 'satori/yoga.wasm?url';
import resvgWasmUrl from '@resvg/resvg-wasm/index_bg.wasm?url';
import { initSatori, initResvg, loadFonts, bytesToBase64, renderOgSpec, type OgSpec } from '$lib/og/core.js';

let initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
	initPromise ??= (async () => {
		const [resvg, yoga] = await Promise.all([
			fetch(resvgWasmUrl).then((r) => r.arrayBuffer()),
			fetch(yogaWasmUrl).then((r) => r.arrayBuffer())
		]);
		await initResvg(resvg);
		await initSatori(yoga);
	})().catch((e) => {
		initPromise = null;
		throw e;
	});
	return initPromise;
}

export function ogImageProxyUrl(url: string): string {
	return `/api/og/image-proxy?url=${encodeURIComponent(url)}`;
}

// 手元の画像(blob:/data:)はそのまま、外部(Bluesky CDN)はCORSが無いので同一オリジンのプロキシ経由で読む
async function resolveImage(url: string): Promise<string | null> {
	try {
		const local = url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('/');
		const res = await fetch(local ? url : ogImageProxyUrl(url));
		if (!res.ok) return null;
		const type = res.headers.get('content-type') || 'image/jpeg';
		return `data:${type};base64,${bytesToBase64(new Uint8Array(await res.arrayBuffer()))}`;
	} catch {
		return null;
	}
}

export async function renderOgBlob(spec: OgSpec): Promise<Blob> {
	await ensureInit();
	const appUrl = location.origin;
	const fonts = await loadFonts(appUrl);
	const png = await renderOgSpec(spec, { fonts, appUrl, resolveImage });
	return new Blob([png as BlobPart], { type: 'image/png' });
}

function ogPath(handle: string, messageId?: string): string {
	const base = `/u/${encodeURIComponent(handle)}`;
	return messageId ? `${base}/m/${encodeURIComponent(messageId)}` : base;
}

// 現在の設定で箱/メッセージのOGP画像を描画し、R2へ保存する(/api/og/u/... はそれを配信する)。
// 生成した画像を返すので、Blueskyへのリンクカード投稿などにそのまま使える。
export async function publishOgImage(handle: string, messageId?: string): Promise<Blob> {
	const path = ogPath(handle, messageId);
	const specRes = await fetch(`/api/og/spec${path}`);
	if (!specRes.ok) throw new Error(`Failed to load OGP spec: ${specRes.status}`);
	const blob = await renderOgBlob((await specRes.json()) as OgSpec);
	const putRes = await fetch(`/api/og${path}`, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/png' } });
	if (!putRes.ok) throw new Error(`Failed to store OGP image: ${putRes.status}`);
	return blob;
}
