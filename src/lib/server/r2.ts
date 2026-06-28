export function r2KeyToUrl(env: App.Platform['env'], key: string): string {
	return `${env.R2_PUBLIC_URL}/${key}`;
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
