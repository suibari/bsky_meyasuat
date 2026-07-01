import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getMessageById, updateMessageAnswerRef } from '$lib/server/db.js';

export const POST: RequestHandler = async ({ params, request, platform, locals }) => {
	const env = platform?.env;
	if (!env) error(503, 'Service unavailable');

	const user = locals.user;
	if (!user) error(401, 'Unauthorized');

	const message = await getMessageById(env, params.id);
	if (!message) error(404, 'Message not found');
	if (message.creatorDid !== user.did) error(403, 'Forbidden');

	const body = await request.json().catch(() => null) as { uri?: string; cid?: string } | null;
	if (!body || !body.uri || !body.cid) {
		error(400, 'Invalid request body');
	}

	const ok = await updateMessageAnswerRef(env, message.id, user.did, body.uri, body.cid);
	if (!ok) error(500, 'Failed to update message');

	return json({ ok: true });
};
