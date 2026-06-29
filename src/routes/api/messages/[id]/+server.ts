import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { deleteMessage } from '$lib/server/db.js';

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
	const env = platform?.env;
	if (!locals.user || !env) error(401, 'Unauthorized');
	await deleteMessage(env, params.id, locals.user.did);
	return json({ ok: true });
};
