import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getMessageById, deleteQuestionForSender } from '$lib/server/db.js';

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
	const env = platform?.env;
	if (!locals.user || !env) error(401, 'Unauthorized');

	const message = await getMessageById(env, params.id);
	if (!message) error(404, 'Message not found');
	if (message.senderDid !== locals.user.did) error(403, 'Forbidden');

	const ok = await deleteQuestionForSender(env, params.id, locals.user.did);
	if (!ok) error(500, 'Failed to delete question');

	return json({ ok: true });
};
