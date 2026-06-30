import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { isSafeRedirect } from '$lib/server/redirect.js';

export const load: PageServerLoad = ({ locals, platform, url }) => {
	const redirectTo = isSafeRedirect(url.searchParams.get('redirect_to'));
	if (locals.user) redirect(302, redirectTo ?? '/dashboard');
	const appUrl = platform?.env?.PUBLIC_APP_URL ?? '';
	return { appUrl, redirectTo };
};
