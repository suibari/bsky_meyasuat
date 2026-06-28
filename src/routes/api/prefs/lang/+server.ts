import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json() as { lang?: string };
	const lang = body.lang === 'en' ? 'en' : 'ja';
	cookies.set('lang', lang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
	return json({ ok: true });
};
