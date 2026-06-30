import type { PageServerLoad } from './$types';
import { updateUser } from '$lib/server/db.js';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	user: locals.user!
});

export const actions: Actions = {
	saveNotify: async ({ locals, request, platform }) => {
		const env = platform?.env;
		if (!locals.user || !env) return fail(401);
		const fd = await request.formData();
		const notifyEnabled = fd.get('notify_enabled') === 'on';
		await updateUser(env, locals.user.did, { notifyEnabled });
		return { saved: true };
	},
	saveBoxName: async ({ locals, request, platform }) => {
		const env = platform?.env;
		if (!locals.user || !env) return fail(401);
		const fd = await request.formData();
		const raw = (fd.get('box_name') as string | null)?.trim() ?? '';
		await updateUser(env, locals.user.did, { boxName: raw || null });
		return { saved: true };
	}
};
