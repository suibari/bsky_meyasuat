import type { Message } from '$lib/server/db.js';
import { parseAtUri, getRecordByAtUri } from '$lib/server/atproto.js';
import { r2KeyToUrl } from '$lib/server/r2.js';

type Env = App.Platform['env'];

export function buildBlobCdnUrl(did: string, cid: string): string {
	return `https://cdn.bsky.app/img/feed_fullsize/plain/${did}/${cid}@jpeg`;
}

// OGP背景用の縮小バリアント。背景は薄く敷くだけなので低解像度で十分。
// フルサイズのデコード/base64/ラスタライズ負荷を抑え、CloudflareのCPU/メモリ上限超過を防ぐ。
export function buildBlobCdnThumbUrl(did: string, cid: string): string {
	return `https://cdn.bsky.app/img/feed_thumbnail/plain/${did}/${cid}@jpeg`;
}

export function extractCid(blob: unknown): string | null {
	if (!blob || typeof blob !== 'object') return null;
	const value = blob as { ref?: unknown; $link?: unknown };
	if (typeof value.$link === 'string') return value.$link;
	if (value.ref && typeof value.ref === 'object') {
		const ref = value.ref as { $link?: unknown };
		if (typeof ref.$link === 'string') return ref.$link;
	}
	return null;
}

/**
 * 質問レコードの value から画像URLを抽出する（純関数）。
 * 一覧のread-through表示時に、既に取得済みの質問レコードから使い回すために公開している。
 */
export function extractImageUrlsFromQuestionRecordValue(
	questionRecordUri: string,
	value: Record<string, unknown> | undefined
): string[] {
	const parsed = parseAtUri(questionRecordUri);
	if (!parsed || !value) return [];
	return extractImageUrlsFromRecordValue(parsed.repo, value);
}

export function extractImageUrlsFromRecordValue(
	repoDid: string,
	value: Record<string, unknown> | undefined
): string[] {
	if (!value) return [];
	const images = value.images;
	if (!Array.isArray(images)) return [];

	const urls: string[] = [];
	for (const item of images) {
		if (!item || typeof item !== 'object') continue;
		const image = (item as { image?: unknown }).image;
		const cid = extractCid(image);
		if (!cid) continue;
		urls.push(buildBlobCdnUrl(repoDid, cid));
	}
	return urls;
}

async function resolveQuestionRecordImageUrls(questionRecordUri: string): Promise<string[]> {
	const record = await getRecordByAtUri(questionRecordUri);
	if (!record.found || !record.value) return [];
	return extractImageUrlsFromQuestionRecordValue(questionRecordUri, record.value);
}

export async function resolveMessageImageUrls(
	env: Env,
	message: Message,
	cache?: Map<string, string[]>
): Promise<string[]> {
	if (message.imageKeys.length > 0) {
		return message.imageKeys.map((k) => r2KeyToUrl(k));
	}
	if (!message.questionRecordUri) return [];

	if (cache?.has(message.questionRecordUri)) {
		return cache.get(message.questionRecordUri) ?? [];
	}

	try {
		const urls = await resolveQuestionRecordImageUrls(message.questionRecordUri);
		cache?.set(message.questionRecordUri, urls);
		return urls;
	} catch {
		cache?.set(message.questionRecordUri, []);
		return [];
	}
}
