const COOKIE_NAME = 'meyasuat_session';
const HMAC_ALG = { name: 'HMAC', hash: 'SHA-256' };

async function getKey(secret: string): Promise<CryptoKey> {
	const raw = new TextEncoder().encode(secret);
	return crypto.subtle.importKey('raw', raw, HMAC_ALG, false, ['sign', 'verify']);
}

async function sign(sessionId: string, secret: string): Promise<string> {
	const key = await getKey(secret);
	const data = new TextEncoder().encode(sessionId);
	const sig = await crypto.subtle.sign(HMAC_ALG.name, key, data);
	return btoa(String.fromCharCode(...new Uint8Array(sig)))
		.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function makeCookieValue(sessionId: string, secret: string): Promise<string> {
	const sig = await sign(sessionId, secret);
	return `${sessionId}.${sig}`;
}

export async function parseCookieValue(
	value: string,
	secret: string
): Promise<string | null> {
	const dot = value.lastIndexOf('.');
	if (dot === -1) return null;
	const sessionId = value.slice(0, dot);
	const givenSig = value.slice(dot + 1);
	const expectedSig = await sign(sessionId, secret);
	if (givenSig !== expectedSig) return null;
	return sessionId;
}

export function cookieName(): string {
	return COOKIE_NAME;
}

export function cookieOptions(expiresAt: Date): string {
	return `Path=/; HttpOnly; SameSite=Lax; Secure; Expires=${expiresAt.toUTCString()}`;
}

export function clearCookieOptions(): string {
	return `Path=/; HttpOnly; SameSite=Lax; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
