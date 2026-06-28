import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/db.js';
import { parseCookieValue, cookieName, clearCookieOptions } from '$lib/server/session.js';

export const POST: RequestHandler = async ({ cookies, platform }) => {
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
};
