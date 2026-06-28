import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ platform }) => {
	const appUrl = platform?.env?.PUBLIC_APP_URL ?? '';
	return { appUrl };
};
