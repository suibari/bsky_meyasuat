import type { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import { Agent } from '@atproto/api';
import { MEYASUAT_OAUTH_SCOPE } from '$lib/oauthScope.js';

type OAuthClientLocation = Pick<Location, 'origin' | 'port'>;

function isLocalhost(url: string): boolean {
	return url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1');
}

export function buildOAuthClientId(appUrl: string, currentLocation: OAuthClientLocation): string {
	const local = isLocalhost(appUrl) || isLocalhost(currentLocation.origin);
	if (!local) return `${appUrl}/oauth/client-metadata.json`;

	const port = currentLocation.port;
	const redirectUri = `http://127.0.0.1${port ? ':' + port : ''}/oauth/callback`;
	const params = new URLSearchParams({
		redirect_uri: redirectUri,
		scope: MEYASUAT_OAUTH_SCOPE
	});
	return `http://localhost?${params.toString()}`;
}

export async function createOAuthClient(appUrl: string): Promise<BrowserOAuthClient> {
	const { BrowserOAuthClient } = await import('@atproto/oauth-client-browser');
	const clientId = buildOAuthClientId(appUrl, location);
	return BrowserOAuthClient.load({
		clientId,
		handleResolver: 'https://bsky.social'
	});
}

// ローカルに保存されたOAuthセッションが壊れている/削除されている場合(TokenRefreshError等)、
// 同じdidに対するPDS呼び出しは以後すべて同じ理由で失敗し続ける。復旧できないため、
// アプリのセッションも強制的に破棄してログイン画面へ戻す。
export async function restoreAgent(appUrl: string, did: string): Promise<Agent> {
	const client = await createOAuthClient(appUrl);
	try {
		const session = await client.restore(did);
		return new Agent(session);
	} catch (e) {
		const { isExpectedSessionError } = await import('@atproto/oauth-client-browser');
		if (isExpectedSessionError(e) && typeof window !== 'undefined') {
			window.location.href = '/api/auth/logout';
		}
		throw e;
	}
}

type ParsedAtUri = {
	repo: string;
	collection: string;
	rkey: string;
};

export function parseAtUri(uri: string): ParsedAtUri | null {
	if (!uri.startsWith('at://')) return null;
	const parts = uri.slice('at://'.length).split('/');
	if (parts.length < 3) return null;
	const [repo, collection, rkey] = parts;
	if (!repo || !collection || !rkey) return null;
	return { repo, collection, rkey };
}

export type ConfigRecordFields = {
	notifyEnabled: boolean;
	shareHandleEnabled: boolean;
	requireNamedEnabled: boolean;
	boxName: string | null;
	colorTheme?: string | null;
	backgroundImage?: unknown;
};

export type PdsImage = {
	image: unknown;
	alt: string;
};

export async function uploadImageUrlsToPds(agent: Agent, imageUrls: string[]): Promise<PdsImage[]> {
	const images: PdsImage[] = [];
	for (const url of imageUrls.slice(0, 4)) {
		const res = await fetch(url);
		if (res.status === 404) continue;
		if (!res.ok) throw new Error('Failed to fetch image for PDS copy');
		const blob = await res.blob();
		const up = await agent.uploadBlob(blob, { encoding: blob.type || 'image/jpeg' });
		images.push({ image: up.data.blob, alt: '' });
	}
	return images;
}

export async function uploadBackgroundImageToPds(agent: Agent, blob: Blob): Promise<unknown> {
	const up = await agent.uploadBlob(blob, { encoding: blob.type || 'image/jpeg' });
	return up.data.blob;
}

export type ShareEmbedInput = {
	url: string;
	// OGP画像。ブラウザで生成済みのBlobを渡す(サーバー経由で取り直すとCPU上限を超えうるため)
	image: Blob;
	title: string;
	description: string;
};

export type ShareEmbedResult = {
	uri: string;
	cid: string;
	postUrl: string | undefined;
};

// app.bsky.embed.external の thumb の maxSize(lexicon定義、2026-10時点で 1,000,000 bytes)。
// 画像添付(app.bsky.embed.images)の上限とは別で、変更されうるので最新の lexicon を確認して更新すること。
export const EXTERNAL_THUMB_MAX_BYTES = 1_000_000;

// OGP画像(PNG)は背景写真入りだと1MB近くになるため、上限を超える場合だけJPEGへ再エンコードして収める。
// 上限内ならPNGのまま(劣化なし)で使う。
export async function fitExternalThumbBlob(blob: Blob, maxBytes = EXTERNAL_THUMB_MAX_BYTES): Promise<Blob> {
	if (blob.size <= maxBytes) return blob;
	const bitmap = await createImageBitmap(blob);
	const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, bitmap.width, bitmap.height);
	ctx.drawImage(bitmap, 0, 0);
	bitmap.close();
	for (const quality of [0.92, 0.85, 0.7, 0.5]) {
		const jpeg = await canvas.convertToBlob({ type: 'image/jpeg', quality });
		if (jpeg.size <= maxBytes) return jpeg;
	}
	throw new Error('OGP image exceeds Bluesky thumbnail size limit');
}

export async function postShareToBluesky(
	appUrl: string,
	did: string,
	text: string,
	embed: ShareEmbedInput
): Promise<ShareEmbedResult> {
	const agent = await restoreAgent(appUrl, did);

	const blob = await fitExternalThumbBlob(embed.image);
	const up = await agent.uploadBlob(blob, { encoding: blob.type || 'image/png' });

	const created = await agent.post({
		text,
		embed: {
			$type: 'app.bsky.embed.external',
			external: { uri: embed.url, title: embed.title, description: embed.description, thumb: up.data.blob }
		}
	});

	const parsed = parseAtUri(created.uri);
	const postUrl = parsed ? `https://bsky.app/profile/${did}/post/${parsed.rkey}` : undefined;
	return { uri: created.uri, cid: created.cid, postUrl };
}

// 設定を自分のPDSへ反映する。config/self は1レコードにフィールドを全部含むため、
// 呼び出し側は変更前の値も含めた完全な設定一式を渡す必要がある。
// createdAt は既存レコードがあればそれを引き継ぎ、無ければ新規作成として現在時刻を刻む。
// colorTheme/backgroundImage は省略時(undefined)のみ既存レコードの値を引き継ぐ
// (null を渡すと明示的にクリアされる) — 片方だけ変更した保存で他方が消えないようにするため。
export async function putConfigRecord(appUrl: string, did: string, config: ConfigRecordFields): Promise<void> {
	const agent = await restoreAgent(appUrl, did);

	let createdAt = new Date().toISOString();
	let existingValue: Record<string, unknown> | undefined;
	try {
		const existing = await agent.com.atproto.repo.getRecord({
			repo: did,
			collection: 'com.suibari.meyasuat.config',
			rkey: 'self'
		});
		existingValue = existing.data.value as Record<string, unknown>;
		if (typeof existingValue?.createdAt === 'string') createdAt = existingValue.createdAt;
	} catch {
		// レコード未作成（初回書き込み）。新規作成として扱う。
	}

	const colorTheme = config.colorTheme !== undefined ? config.colorTheme : (existingValue?.colorTheme as string | undefined) ?? null;
	const backgroundImage = config.backgroundImage !== undefined ? config.backgroundImage : existingValue?.backgroundImage ?? null;

	await agent.com.atproto.repo.putRecord({
		repo: did,
		collection: 'com.suibari.meyasuat.config',
		rkey: 'self',
		record: {
			$type: 'com.suibari.meyasuat.config',
			notifyEnabled: config.notifyEnabled,
			shareHandleEnabled: config.shareHandleEnabled,
			requireNamedEnabled: config.requireNamedEnabled,
			...(config.boxName ? { boxName: config.boxName } : {}),
			...(colorTheme ? { colorTheme } : {}),
			...(backgroundImage ? { backgroundImage } : {}),
			createdAt
		}
	});
}

export async function deleteRecordOnPds(appUrl: string, did: string, uri: string): Promise<void> {
	const parsed = parseAtUri(uri);
	if (!parsed) throw new Error('Invalid at:// URI');
	if (parsed.repo !== did) throw new Error('Record repo does not match signed-in user');

	const agent = await restoreAgent(appUrl, did);
	await agent.com.atproto.repo.deleteRecord({
		repo: parsed.repo,
		collection: parsed.collection,
		rkey: parsed.rkey
	});
}

// 自分のリポジトリの指定コレクションのレコードを全ページ走査して削除する。
// 箱削除時のPDSクリーンアップ用。best-effort（1件の失敗で全体を止めない）。
export async function deleteAllRecordsInCollection(
	appUrl: string,
	did: string,
	collection: string
): Promise<void> {
	const agent = await restoreAgent(appUrl, did);

	let cursor: string | undefined;
	do {
		const res = await agent.com.atproto.repo.listRecords({
			repo: did,
			collection,
			limit: 100,
			cursor
		});
		for (const record of res.data.records) {
			const parsed = parseAtUri(record.uri);
			if (!parsed) continue;
			try {
				await agent.com.atproto.repo.deleteRecord({
					repo: did,
					collection: parsed.collection,
					rkey: parsed.rkey
				});
			} catch (e) {
				console.error('Failed to delete record on PDS', record.uri, e);
			}
		}
		cursor = res.data.cursor;
	} while (cursor);
}
