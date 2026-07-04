import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getMessageById, updateMessageQuestionRef } from '$lib/server/db.js';
import { getRecordByAtUri, parseAtUri } from '$lib/server/atproto.js';

export const POST: RequestHandler = async ({ params, request, platform, locals }) => {
	const env = platform?.env;
	if (!env) error(503, 'Service unavailable');

	const user = locals.user;
	if (!user) error(401, 'Unauthorized');

	const message = await getMessageById(env, params.id);
	if (!message) error(404, 'Message not found');

	const body = await request.json().catch(() => null) as { uri?: string } | null;
	if (!body || !body.uri) {
		error(400, 'Invalid request body');
	}

	const parsed = parseAtUri(body.uri);
	if (!parsed || parsed.repo !== user.did || parsed.collection !== 'com.suibari.meyasuat.question') {
		error(403, 'Forbidden');
	}
	const record = await getRecordByAtUri(body.uri).catch(() => null);
	if (!record?.found || !record.value) error(404, 'Question record not found');
	if (record.value.subject !== message.creatorDid) error(403, 'Forbidden');
	const recordUrl = typeof record.value.url === 'string' ? record.value.url : '';
	if (!recordUrl.endsWith(`/m/${message.id}`)) error(403, 'Forbidden');

	const ok = await updateMessageQuestionRef(env, message.id, body.uri);
	if (!ok) error(500, 'Failed to update message');

	return json({ ok: true });
};
