import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const env = platform?.env;
	if (!env || !locals.user) error(401, 'Unauthorized');

	await request.json().catch(() => null);
	return json({ ok: true });
};
