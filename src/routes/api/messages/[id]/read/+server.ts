import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getMessageById, markMessageRead, markMessageUnread } from '$lib/server/db.js';

export const PATCH: RequestHandler = async ({ params, locals, platform, request }) => {
	const env = platform?.env;
	if (!locals.user || !env) error(401, 'Unauthorized');

	const message = await getMessageById(env, params.id);
	if (!message) error(404, 'Message not found');
	if (message.creatorDid !== locals.user.did) error(403, 'Forbidden');
	if (message.answer) error(400, 'Cannot change read state of an answered message');

	const body = await request.json().catch(() => ({})) as { read?: boolean };
	if (body.read === false) {
		await markMessageUnread(env, params.id, locals.user.did);
	} else {
		await markMessageRead(env, params.id, locals.user.did);
	}
	return json({ ok: true });
};
