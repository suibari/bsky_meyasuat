import { waitLocale } from 'svelte-i18n';
import { setupI18n } from '$lib/i18n';

export async function load({ data }) {
	setupI18n(data.lang);
	await waitLocale();
	return { lang: data.lang };
}
