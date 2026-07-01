import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getMessageById, deleteQuestionForSender } from '$lib/server/db.js';
import { getRecordByAtUri } from '$lib/server/atproto.js';

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
	const env = platform?.env;
	if (!locals.user || !env) error(401, 'Unauthorized');

	const message = await getMessageById(env, params.id);
	if (!message) error(404, 'Message not found');
	if (message.senderDid !== locals.user.did) error(403, 'Forbidden');

	if (message.questionRecordUri) {
		let lookup;
		try {
			lookup = await getRecordByAtUri(message.questionRecordUri);
		} catch {
			error(502, 'Failed to verify PDS question record');
		}
		if (lookup.found) {
			error(409, 'Question record still exists on PDS');
		}
	}

	const ok = await deleteQuestionForSender(env, params.id, locals.user.did);
	if (!ok) error(500, 'Failed to delete question');

	return json({ ok: true });
};
