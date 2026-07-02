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
