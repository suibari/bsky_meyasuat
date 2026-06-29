import type { Handle } from '@sveltejs/kit';
import { cookieName, parseCookieValue } from '$lib/server/session.js';
import { getSession, getUserByDid } from '$lib/server/db.js';
import { syncUserHandle } from '$lib/server/atproto.js';

const HOUR_MS = 60 * 60 * 1000;

export const handle: Handle = async ({ event, resolve }) => {
	// 開発時: localhost と 127.0.0.1 は別オリジン扱いとなり、
	// OAuth コールバック先（127.0.0.1）とセッション Cookie のオリジンがずれる。
	// すべて 127.0.0.1 に寄せてオリジンを統一する。
	if (event.url.hostname === 'localhost') {
		const url = new URL(event.url);
		url.hostname = '127.0.0.1';
		return Response.redirect(url.toString(), 307);
	}

	const env = event.platform?.env;
	const ctx = event.platform?.context;

	// 言語 Cookie を読む
	const lang = (event.cookies.get('lang') === 'en' ? 'en' : 'ja') as 'ja' | 'en';
	event.locals.lang = lang;
	event.locals.user = null;
	event.locals.sessionId = null;

	// セッション Cookie を検証
	const rawCookie = event.cookies.get(cookieName());
	if (rawCookie && env) {
		const sessionId = await parseCookieValue(rawCookie, env.SESSION_SECRET);
		if (sessionId) {
			const session = await getSession(env, sessionId);
			if (session && new Date(session.expiresAt) > new Date()) {
				const user = await getUserByDid(env, session.userDid);
				if (user) {
					event.locals.user = user;
					event.locals.sessionId = sessionId;

					// 1時間以上アクセスがなければハンドル変更を非同期で確認
					const createdAt = new Date(session.createdAt).getTime();
					if (ctx && Date.now() - createdAt > HOUR_MS) {
						ctx.waitUntil(syncUserHandle(env, user.did));
					}
				}
			}
		}
	}

	if (event.locals.user && event.url.pathname === '/') {
		return Response.redirect(new URL('/dashboard', event.url).toString(), 302);
	}

	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', lang)
	});
};
