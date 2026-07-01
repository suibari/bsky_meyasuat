import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, platform }) => {
	const env = platform?.env;
	if (!env) error(503, 'Service unavailable');

	const key = params.key;
	if (!key || key.includes('..') || key.startsWith('/')) {
		error(400, 'Invalid key');
	}
	if (!key.startsWith('messages/')) {
		error(403, 'Forbidden');
	}

	const obj = await env.R2.get(key);
	if (!obj) error(404, 'Not found');

	const contentType = obj.httpMetadata?.contentType ?? 'application/octet-stream';
	const cacheControl = obj.httpMetadata?.cacheControl ?? 'public, max-age=3600';

	return new Response(obj.body, {
		headers: {
			'Content-Type': contentType,
			'Cache-Control': cacheControl
		}
	});
};
