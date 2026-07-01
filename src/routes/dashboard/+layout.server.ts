import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.user) {
		const target = `${url.pathname}${url.search}`;
		redirect(302, `/?redirect_to=${encodeURIComponent(target)}`);
	}
	return { user: locals.user };
};
