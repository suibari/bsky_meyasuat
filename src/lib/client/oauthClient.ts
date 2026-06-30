import { BrowserOAuthClient } from '@atproto/oauth-client-browser';

function isLocalhost(url: string): boolean {
	return url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1');
}

export async function createOAuthClient(appUrl: string): Promise<BrowserOAuthClient> {
	const local = isLocalhost(appUrl) || isLocalhost(location.origin);
	const clientId = local
		? (() => {
				const port = location.port;
				const redirectUri = `http://127.0.0.1${port ? ':' + port : ''}/oauth/callback`;
				return `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}`;
			})()
		: `${appUrl}/oauth/client-metadata.json`;
	return BrowserOAuthClient.load({
		clientId,
		handleResolver: 'https://bsky.social'
	});
}
