import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getMessageById, answerMessage, deleteAnswerForCreator } from '$lib/server/db.js';

export const POST: RequestHandler = async ({ params, locals, platform, request }) => {
	const env = platform?.env;
	if (!locals.user || !env) error(401, 'Unauthorized');

	const message = await getMessageById(env, params.id);
	if (!message) error(404, 'Message not found');
	if (message.creatorDid !== locals.user.did) error(403, 'Forbidden');
	if (message.answer) error(400, 'Already answered');

	const body = await request.json().catch(() => ({})) as { answer?: string };
	const answer = (body.answer ?? '').trim();
	if (!answer) error(400, 'Answer is required');
	if (answer.length > 1000) error(400, 'Answer too long');

	await answerMessage(env, params.id, locals.user.did, answer);

	return json({ ok: true, answer, answeredAt: new Date().toISOString() });
};

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
	const env = platform?.env;
	if (!locals.user || !env) error(401, 'Unauthorized');

	const message = await getMessageById(env, params.id);
	if (!message) error(404, 'Message not found');
	if (message.creatorDid !== locals.user.did) error(403, 'Forbidden');
	if (!message.answer) error(400, 'Answer is already empty');

	const ok = await deleteAnswerForCreator(env, params.id, locals.user.did);
	if (!ok) error(500, 'Failed to delete answer');

	return json({ ok: true });
};
