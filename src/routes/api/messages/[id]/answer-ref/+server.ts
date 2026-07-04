import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { deleteMessage, getMessageById } from '$lib/server/db.js';
import { deleteManyFromR2 } from '$lib/server/r2.js';

export const POST: RequestHandler = async ({ params, request, platform, locals }) => {
	const env = platform?.env;
	if (!env) error(503, 'Service unavailable');

	const user = locals.user;
	if (!user) error(401, 'Unauthorized');

	const message = await getMessageById(env, params.id);
	if (!message) error(404, 'Message not found');
	if (message.creatorDid !== user.did) error(403, 'Forbidden');

	const body = await request.json().catch(() => null) as { uri?: string } | null;
	if (!body || !body.uri) {
		error(400, 'Invalid request body');
	}

	if (!message.senderDid && message.imageKeys.length > 0) {
		await deleteManyFromR2(env, message.imageKeys);
	}
	await deleteMessage(env, message.id, user.did);

	return json({ ok: true });
};
