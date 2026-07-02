import { describe, expect, it } from 'vitest';
import metadata from '../static/oauth/client-metadata.json';
import { buildOAuthClientId } from '../src/lib/client/oauthClient.js';
import { MEYASUAT_OAUTH_SCOPE } from '../src/lib/oauthScope.js';

const requiredScopes = [
	'repo:com.suibari.meyasuat.question?action=create',
	'repo:com.suibari.meyasuat.question?action=delete',
	'repo:com.suibari.meyasuat.answer?action=create',
	'repo:com.suibari.meyasuat.answer?action=delete'
];

describe('meyasuat OAuth scope', () => {
	it('keeps public client metadata in sync with the app scope constant', () => {
		expect(metadata.scope).toBe(MEYASUAT_OAUTH_SCOPE);
		for (const scope of requiredScopes) {
			expect(metadata.scope.split(' ')).toContain(scope);
		}
	});

	it('includes the same scope in local loopback client ids', () => {
		const clientId = buildOAuthClientId('http://localhost:5173', {
			origin: 'http://127.0.0.1:5173',
			port: '5173'
		});
		const parsed = new URL(clientId);

		expect(parsed.origin).toBe('http://localhost');
		expect(parsed.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:5173/oauth/callback');
		expect(parsed.searchParams.get('scope')).toBe(MEYASUAT_OAUTH_SCOPE);
	});
});
