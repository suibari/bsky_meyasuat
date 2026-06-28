import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = ({ locals, platform }) => {
	if (locals.user) redirect(302, '/dashboard');
	const appUrl = platform?.env?.PUBLIC_APP_URL ?? '';
	return { appUrl };
};
