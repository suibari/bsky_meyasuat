import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { resolveBoxOgSpec } from '$lib/server/ogSpec.js';
import { respondOgImage, storeOgImage } from '$lib/server/ogImage.js';

export const GET: RequestHandler = async ({ params, platform, url }) => {
	if (!platform?.env) error(503, 'Service unavailable');
	return respondOgImage(platform, url, () => resolveBoxOgSpec(platform.env, params.handle));
};

export const PUT: RequestHandler = async ({ params, platform, request, locals }) => {
	if (!platform?.env) error(503, 'Service unavailable');
	return storeOgImage(platform, request, locals.user, () => resolveBoxOgSpec(platform.env, params.handle));
};
