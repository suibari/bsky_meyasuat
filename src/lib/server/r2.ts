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

// ブラウザで事前生成したOGP画像の保存先。ogVersion(テーマ/背景の組み合わせ)ごとに分け、
// 設定変更で ogVersion が変われば別キーになる(古いものは box 保存時に掃除する)。
// 名前・アイコン・本文など ogVersion に含まれない内容の変化は specHash で区別し、古い画像を配信しないようにする。
// ogVersion にはPDSレコード由来の文字列(colorTheme)が含まれるため、各要素はエンコードする。
export function ogImagePrefix(did: string): string {
	return `og/${encodeURIComponent(did)}/`;
}

export function ogImageVersionPrefix(did: string, ogVersion: string): string {
	return `${ogImagePrefix(did)}${encodeURIComponent(ogVersion)}/`;
}

export function ogImageKeyPrefix(did: string, ogVersion: string, messageId?: string): string {
	const base = ogImageVersionPrefix(did, ogVersion);
	// 区切りの @ は encodeURIComponent が必ずエンコードする文字なので、IDの前方一致で他のメッセージを巻き込まない
	return messageId ? `${base}m/${encodeURIComponent(messageId)}@` : `${base}box@`;
}

export function ogImageKey(did: string, ogVersion: string, specHash: string, messageId?: string): string {
	return `${ogImageKeyPrefix(did, ogVersion, messageId)}${specHash}.png`;
}

export async function deleteR2Prefix(
	env: App.Platform['env'],
	prefix: string,
	keep: (key: string) => boolean = () => false
): Promise<void> {
	let cursor: string | undefined;
	do {
		const list = await env.R2.list({ prefix, cursor });
		const keys = list.objects.map((o) => o.key).filter((key) => !keep(key));
		if (keys.length > 0) await env.R2.delete(keys);
		cursor = list.truncated ? list.cursor : undefined;
	} while (cursor);
}
