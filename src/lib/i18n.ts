import { browser } from '$app/environment';
import { init, register, locale, getLocaleFromNavigator } from 'svelte-i18n';

register('ja', () => import('./locales/ja.json'));
register('en', () => import('./locales/en.json'));

export const supportedLocales = ['ja', 'en'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export function setupI18n(lang: SupportedLocale) {
	init({
		fallbackLocale: 'ja',
		initialLocale: lang
	});
}

export function detectLocale(): SupportedLocale {
	if (!browser) return 'ja';
	const nav = getLocaleFromNavigator() ?? 'ja';
	return nav.startsWith('en') ? 'en' : 'ja';
}

export { locale };
