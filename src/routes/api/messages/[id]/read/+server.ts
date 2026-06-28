import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { markMessageRead } from '$lib/server/db.js';

export const PATCH: RequestHandler = async ({ params, locals, platform }) => {
	const env = platform?.env;
	if (!locals.user || !env) error(401, 'Unauthorized');
	await markMessageRead(env, params.id, locals.user.did);
	return json({ ok: true });
};
