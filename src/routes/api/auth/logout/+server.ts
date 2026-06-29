import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/db.js';
import { parseCookieValue, cookieName, clearCookieOptions } from '$lib/server/session.js';

async function doLogout({ cookies, platform }: { cookies: Parameters<RequestHandler>[0]['cookies'], platform: Parameters<RequestHandler>[0]['platform'] }) {
	const env = platform?.env;
	const raw = cookies.get(cookieName());
	if (raw && env) {
		const sessionId = await parseCookieValue(raw, env.SESSION_SECRET);
		if (sessionId) await deleteSession(env, sessionId);
	}
	const headers = new Headers();
	headers.set('Set-Cookie', `${cookieName()}=; ${clearCookieOptions()}`);
	headers.set('Location', '/');
	return new Response(null, { status: 302, headers });
}

export const GET: RequestHandler = ({ cookies, platform }) => doLogout({ cookies, platform });

export const POST: RequestHandler = ({ cookies, platform }) => doLogout({ cookies, platform });
