import { createHmac } from 'node:crypto';

// tests/e2e/mock-postgrest.mjs と tests/e2e/wrangler.e2e.toml で共有するテスト用の固定値。
export const E2E_PORT = 4174;
export const MOCK_POSTGREST_PORT = 54330;
export const SESSION_SECRET = 'e2e-session-secret';
export const SESSION_ID = 'e2e-session';
export const USER_DID = 'did:plc:e2emeyasuattestuser';
export const USER_HANDLE = 'e2e-user.test';

// src/lib/server/session.ts の makeCookieValue と同じ形式(sessionId.HMAC-SHA256のbase64url)
export function sessionCookieValue(): string {
	const sig = createHmac('sha256', SESSION_SECRET).update(SESSION_ID).digest('base64url');
	return `${SESSION_ID}.${sig}`;
}
