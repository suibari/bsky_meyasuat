<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { t } from 'svelte-i18n';
	import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let handle = $state('');
	let loading = $state(false);
	let error = $state('');

	// ローカル開発時: IndexedDB はオリジン単位でスコープされるため、
	// localhost と 127.0.0.1 は別オリジンとして扱われる。
	// OAuth コールバックは 127.0.0.1 に届くので、state 保存元も同じオリジンにする必要がある。
	onMount(() => {
		if (window.location.hostname === 'localhost') {
			window.location.replace(
				window.location.href.replace('http://localhost', 'http://127.0.0.1')
			);
		}
	});

	function isLocalhost(url: string): boolean {
		return url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1');
	}

	async function signin() {
		if (!browser) return;
		const h = handle.trim().replace(/^@/, '');
		if (!h) return;

		loading = true;
		error = '';
		try {
			// localhost 開発: AT Protocol OAuth spec の localhost client 特例を使用
			// https://atproto.com/ja/specs/oauth#localhost-client-development
			const local = isLocalhost(data.appUrl) || isLocalhost(location.origin);
			const clientId = local
				? (() => {
						const port = location.port;
						const redirectUri = `http://127.0.0.1${port ? ':' + port : ''}/oauth/callback`;
						return `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}`;
					})()
				: `${data.appUrl}/oauth/client-metadata.json`;
			const client = await BrowserOAuthClient.load({
				clientId,
				handleResolver: 'https://bsky.social'
			});
			await client.signIn(h);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>{$t('signin.title')} - {$t('app.name')}</title>
</svelte:head>

<div class="max-w-sm mx-auto px-4 py-16">
	<div class="text-center mb-8">
		<h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
			{$t('signin.title')}
		</h1>
		<p class="text-slate-500 dark:text-slate-400 text-sm">
			{$t('signin.description')}
		</p>
	</div>

	<div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
		{#if loading}
			<div class="text-center py-4 text-slate-500 dark:text-slate-400">
				<div class="inline-block w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-2"></div>
				<p class="text-sm">{$t('signin.loading')}</p>
			</div>
		{:else}
			{#if error}
				<p class="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2">{error}</p>
			{/if}
			<form onsubmit={(e) => { e.preventDefault(); signin(); }}>
				<label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5" for="handle">
					{$t('signin.handle_label')}
				</label>
				<input
					id="handle"
					type="text"
					bind:value={handle}
					placeholder={$t('signin.handle_placeholder')}
					autocomplete="username"
					class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
				/>
				<button
					type="submit"
					class="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
				>
					{$t('signin.button')}
				</button>
			</form>
		{/if}
	</div>
</div>
