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
};

// 設定を自分のPDSへ反映する。config/self は1レコードにフィールドを全部含むため、
// 呼び出し側は変更前の値も含めた完全な設定一式を渡す必要がある。
// createdAt は既存レコードがあればそれを引き継ぎ、無ければ新規作成として現在時刻を刻む。
export async function putConfigRecord(appUrl: string, did: string, config: ConfigRecordFields): Promise<void> {
	const client = await createOAuthClient(appUrl);
	const session = await client.restore(did);
	const agent = new Agent(session);

	let createdAt = new Date().toISOString();
	try {
		const existing = await agent.com.atproto.repo.getRecord({
			repo: did,
			collection: 'com.suibari.meyasuat.config',
			rkey: 'self'
		});
		const existingCreatedAt = (existing.data.value as { createdAt?: unknown })?.createdAt;
		if (typeof existingCreatedAt === 'string') createdAt = existingCreatedAt;
	} catch {
		// レコード未作成（初回書き込み）。新規作成として扱う。
	}

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
			createdAt
		}
	});
}

export async function deleteRecordOnPds(appUrl: string, did: string, uri: string): Promise<void> {
	const parsed = parseAtUri(uri);
	if (!parsed) throw new Error('Invalid at:// URI');
	if (parsed.repo !== did) throw new Error('Record repo does not match signed-in user');

	const client = await createOAuthClient(appUrl);
	const session = await client.restore(did);
	const agent = new Agent(session);
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
	const client = await createOAuthClient(appUrl);
	const session = await client.restore(did);
	const agent = new Agent(session);

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
