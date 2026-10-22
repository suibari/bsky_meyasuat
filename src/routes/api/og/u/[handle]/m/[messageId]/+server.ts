import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { resolveMessageOgSpec } from '$lib/server/ogSpec.js';
import { respondOgImage, storeOgImage } from '$lib/server/ogImage.js';

export const GET: RequestHandler = async ({ params, platform, url }) => {
	if (!platform?.env) error(503, 'Service unavailable');
	const appUrl = platform.env.PUBLIC_APP_URL || url.origin;
	return respondOgImage(
		platform,
		url,
		() => resolveMessageOgSpec(platform.env, params.handle, params.messageId, appUrl),
		params.messageId
	);
};

export const PUT: RequestHandler = async ({ params, platform, request, locals, url }) => {
	if (!platform?.env) error(503, 'Service unavailable');
	const appUrl = platform.env.PUBLIC_APP_URL || url.origin;
	return storeOgImage(
		platform,
		request,
		locals.user,
		() => resolveMessageOgSpec(platform.env, params.handle, params.messageId, appUrl),
		params.messageId
	);
};
