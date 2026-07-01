import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { deleteMessage, getMessageById } from '$lib/server/db.js';
import { deleteManyFromR2 } from '$lib/server/r2.js';

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
	const env = platform?.env;
	if (!locals.user || !env) error(401, 'Unauthorized');

	const message = await getMessageById(env, params.id);
	if (!message) error(404, 'Message not found');
	if (message.creatorDid !== locals.user.did) error(403, 'Forbidden');

	await deleteManyFromR2(env, message.imageKeys);
	await deleteMessage(env, params.id, locals.user.did);

	return json({ ok: true });
};
