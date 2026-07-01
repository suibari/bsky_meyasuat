export function r2KeyToUrl(key: string): string {
	const safeKey = key
		.split('/')
		.filter((part) => part.length > 0)
		.map((part) => encodeURIComponent(part))
		.join('/');
	return `/api/images/${safeKey}`;
}

export function messageImageKey(messageId: string, index: number, ext = 'jpg'): string {
	const now = new Date();
	const y = now.getUTCFullYear();
	const m = String(now.getUTCMonth() + 1).padStart(2, '0');
	return `messages/${y}/${m}/${messageId}-${index}.${ext}`;
}

export async function uploadToR2(
	env: App.Platform['env'],
	key: string,
	data: ArrayBuffer,
	contentType: string
): Promise<void> {
	await env.R2.put(key, data, {
		httpMetadata: { contentType }
	});
}

export async function deleteFromR2(env: App.Platform['env'], key: string): Promise<void> {
	await env.R2.delete(key);
}

export async function deleteManyFromR2(env: App.Platform['env'], keys: string[]): Promise<void> {
	if (keys.length === 0) return;
	await Promise.allSettled(keys.map((key) => deleteFromR2(env, key)));
}

export async function getTotalR2Bytes(
	env: App.Platform['env'],
	prefix = 'messages/'
): Promise<number> {
	let total = 0;
	let cursor: string | undefined;

	do {
		const list = await env.R2.list({ prefix, cursor });
		for (const object of list.objects) {
			total += object.size;
		}
		cursor = list.truncated ? list.cursor : undefined;
	} while (cursor);

	return total;
}
