import type { Message } from '$lib/server/db.js';
import { parseAtUri, getRecordByAtUri } from '$lib/server/atproto.js';
import { r2KeyToUrl } from '$lib/server/r2.js';

type Env = App.Platform['env'];

function extractCid(blob: unknown): string | null {
	if (!blob || typeof blob !== 'object') return null;
	const value = blob as { ref?: unknown; $link?: unknown };
	if (typeof value.$link === 'string') return value.$link;
	if (value.ref && typeof value.ref === 'object') {
		const ref = value.ref as { $link?: unknown };
		if (typeof ref.$link === 'string') return ref.$link;
	}
	return null;
}

async function resolveQuestionRecordImageUrls(questionRecordUri: string): Promise<string[]> {
	const parsed = parseAtUri(questionRecordUri);
	if (!parsed) return [];

	const record = await getRecordByAtUri(questionRecordUri);
	if (!record.found || !record.value) return [];

	const images = record.value.images;
	if (!Array.isArray(images)) return [];

	const urls: string[] = [];
	for (const item of images) {
		if (!item || typeof item !== 'object') continue;
		const image = (item as { image?: unknown }).image;
		const cid = extractCid(image);
		if (!cid) continue;
		urls.push(`https://cdn.bsky.app/img/feed_fullsize/plain/${parsed.repo}/${cid}@jpeg`);
	}
	return urls;
}

export async function resolveMessageImageUrls(
	env: Env,
	message: Message,
	cache?: Map<string, string[]>
): Promise<string[]> {
	if (message.imageKeys.length > 0) {
		return message.imageKeys.map((k) => r2KeyToUrl(env, k));
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
