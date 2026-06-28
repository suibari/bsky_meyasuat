import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.user) redirect(302, '/signin');
	return { user: locals.user };
};
