import { error } from '@sveltejs/kit';
import { ensureInit, loadFonts, fetchImageAsDataUri, renderOgSpec } from '$lib/server/og.js';
import { ogImageKey, ogImageKeyPrefix, ogImagePrefix, ogImageVersionPrefix, deleteR2Prefix } from '$lib/server/r2.js';
import type { OgSpec } from '$lib/og/core.js';
import type { ResolvedOgSpec } from '$lib/server/ogSpec.js';

type Platform = App.Platform;

const LONG_CACHE = 'public, max-age=86400, stale-while-revalidate=604800';
const MAX_UPLOAD_BYTES = 2_000_000;
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// 描画内容(spec)のハッシュ。保存時と配信時で同じspecなら同じキーになり、内容が変われば保存済み画像は使われない。
async function specHash(spec: OgSpec): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(spec)));
	return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// OGP画像を返す。WorkersのFreeプラン(CPU 10ms)では背景画像入りの描画(100ms超)が上限を超えるため、
// 描画はブラウザ側で行ってR2へ保存したもの(PUTで受け取る)を返すのが基本。
// R2に無い場合だけサーバーで描画するが、重い背景は省き、背景が抜けた結果は短命にしてエッジキャッシュもしない。
export async function respondOgImage(
	platform: Platform,
	url: URL,
	resolve: () => Promise<ResolvedOgSpec>,
	messageId?: string
): Promise<Response> {
	const env = platform.env;
	// Pages FunctionsのレスポンスはCache-Controlだけではキャッシュされないので Cache API を使う
	const edgeCache = platform.caches.default;
	const cacheKey = url.toString();
	const cached = await edgeCache.match(cacheKey as any);
	if (cached) return cached as unknown as Response;

	const { creator, spec } = await resolve();

	const stored = await env.R2.get(ogImageKey(creator.did, creator.ogVersion, await specHash(spec), messageId));
	if (stored) {
		const response = new Response(stored.body as unknown as ReadableStream, {
			headers: {
				'Content-Type': 'image/png',
				'Cache-Control': LONG_CACHE,
				'Access-Control-Allow-Origin': '*'
			}
		});
		platform.context.waitUntil(edgeCache.put(cacheKey as any, response.clone() as any));
		return response;
	}

	const appUrl = env.PUBLIC_APP_URL || url.origin;
	await ensureInit();
	const fonts = await loadFonts(appUrl);
	const png = await renderOgSpec({ ...spec, backgroundUrl: null }, { fonts, appUrl, resolveImage: fetchImageAsDataUri });

	const degraded = spec.backgroundUrl !== null;
	const response = new Response(png.buffer as ArrayBuffer, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': degraded ? 'public, max-age=60' : LONG_CACHE,
			'Access-Control-Allow-Origin': '*'
		}
	});
	if (!degraded) platform.context.waitUntil(edgeCache.put(cacheKey as any, response.clone() as any));
	return response;
}

function readPngSize(bytes: Uint8Array): { width: number; height: number } | null {
	if (bytes.byteLength < 24 || PNG_SIGNATURE.some((b, i) => bytes[i] !== b)) return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20) };
}

// ブラウザで生成したOGP画像(PNG)を、本人の箱/メッセージの分だけR2へ保存する。
// 保存先キーはサーバー側で解決した現在の ogVersion から決めるので、クライアントは画像だけ送ればよい。
export async function storeOgImage(
	platform: Platform,
	request: Request,
	user: App.Locals['user'],
	resolve: () => Promise<ResolvedOgSpec>,
	messageId?: string
): Promise<Response> {
	const env = platform.env;
	if (!user) error(401, 'Unauthorized');

	const { creator, spec } = await resolve();
	if (creator.did !== user.did) error(403, 'Forbidden');

	const bytes = new Uint8Array(await request.arrayBuffer());
	if (bytes.byteLength > MAX_UPLOAD_BYTES) error(413, 'Image too large');
	const size = readPngSize(bytes);
	if (!size) error(400, 'Invalid PNG');
	if (size.width !== OG_WIDTH || size.height !== OG_HEIGHT) error(400, 'Invalid image size');

	const key = ogImageKey(creator.did, creator.ogVersion, await specHash(spec), messageId);
	await env.R2.put(key, bytes, { httpMetadata: { contentType: 'image/png' } });

	// 同じ箱/メッセージの古い内容の画像を掃除する。箱の保存時は古い ogVersion の画像(メッセージ分も含む)もまとめて消す。
	const currentVersionPrefix = ogImageVersionPrefix(creator.did, creator.ogVersion);
	platform.context.waitUntil(
		Promise.all([
			deleteR2Prefix(env, ogImageKeyPrefix(creator.did, creator.ogVersion, messageId), (k) => k === key),
			messageId
				? Promise.resolve()
				: deleteR2Prefix(env, ogImagePrefix(creator.did), (k) => k.startsWith(currentVersionPrefix))
		])
	);
	return new Response(null, { status: 204 });
}
