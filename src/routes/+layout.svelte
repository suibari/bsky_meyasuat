<script lang="ts">
	import './layout.css';
	import { locale } from '$lib/i18n.js';
	import { t } from 'svelte-i18n';
	import type { LayoutData } from './$types';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const user = $derived(data.user);
	const lang = $derived(data.lang);

	$effect(() => { locale.set(lang); });
</script>

<div class="min-h-screen flex flex-col">
	<header class="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
		<div class="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
			<a href="/" class="font-bold text-primary-600 dark:text-primary-400 text-lg tracking-tight">
				{$t('app.name')}
			</a>
			<nav class="flex items-center gap-3 text-sm">
				{#if user}
					<a href="/dashboard" class="text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
						{$t('nav.dashboard')}
					</a>
					<a href="/dashboard/settings" class="text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
						{$t('nav.settings')}
					</a>
					<form method="POST" action="/api/auth/logout">
						<button type="submit" class="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
							{$t('nav.signout')}
						</button>
					</form>
				{:else}
					<a href="/signin" class="bg-primary-600 hover:bg-primary-700 text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors">
						{$t('nav.signin')}
					</a>
				{/if}
				<LanguageSwitcher lang={lang} size="sm" />
			</nav>
		</div>
	</header>

	<main class="flex-1">
		{@render children()}
	</main>

	<footer class="border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
		<p>{$t('app.name')} &copy; {new Date().getFullYear()}</p>
	</footer>
</div>
