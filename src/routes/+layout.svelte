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
	<header class="border-b border-slate-800 bg-slate-900">
		<div class="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
			<a href="/">
				{#if lang === 'ja'}
					<img src="/title-nav.png" alt={$t('app.name')} class="h-5 w-auto" />
				{:else}
					<span class="font-killgothic font-bold text-primary-400 text-lg">{$t('app.name')}</span>
				{/if}
			</a>
			<nav class="flex items-center gap-3 text-sm">
				<LanguageSwitcher lang={lang} size="sm" />
				{#if user}
					<a href="/dashboard/settings" aria-label={$t('nav.settings')} class="block rounded-full ring-2 ring-transparent hover:ring-primary-400 transition-all">
						{#if user.avatarUrl}
							<img src={user.avatarUrl} alt={user.displayName ?? user.handle} class="w-7 h-7 rounded-full object-cover" />
						{:else}
							<div class="w-7 h-7 rounded-full bg-primary-900 flex items-center justify-center text-primary-300 font-bold text-xs">
								{(user.displayName ?? user.handle)[0].toUpperCase()}
							</div>
						{/if}
					</a>
				{:else}
					<a href="/#landing-handle" class="bg-primary-600 hover:bg-primary-700 text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors">
						{$t('nav.signin')}
					</a>
				{/if}
			</nav>
		</div>
	</header>

	<main class="flex-1">
		{@render children()}
	</main>

	<footer class="border-t border-slate-800 py-6 text-center text-xs text-slate-400">
		<p class="font-killgothic">{$t('app.name')} / {new Date().getFullYear()}</p>
	</footer>
</div>
