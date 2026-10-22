import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { resolveBoxOgSpec } from '$lib/server/ogSpec.js';

// ブラウザでOGP画像を描画するための入力。描画結果を保存できるのは本人だけなので本人にだけ返す。
export const GET: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env) error(503, 'Service unavailable');
	if (!locals.user) error(401, 'Unauthorized');
	const { creator, spec } = await resolveBoxOgSpec(platform.env, params.handle);
	if (creator.did !== locals.user.did) error(403, 'Forbidden');
	return json(spec, { headers: { 'Cache-Control': 'no-store' } });
};
