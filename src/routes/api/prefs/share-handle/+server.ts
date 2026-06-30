import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { updateUser } from '$lib/server/db.js';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const env = platform?.env;
	if (!env || !locals.user) error(401, 'Unauthorized');

	const body = await request.json() as { enabled?: boolean };
	const enabled = body.enabled === true;
	await updateUser(env, locals.user.did, { shareHandleEnabled: enabled });
	return json({ ok: true });
};
