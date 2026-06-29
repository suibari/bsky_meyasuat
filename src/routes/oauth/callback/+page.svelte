<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from 'svelte-i18n';
	import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let error = $state('');
	let formEl: HTMLFormElement;
	let didInput: HTMLInputElement;

	function isLocalhost(url: string): boolean {
		return url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1');
	}

	onMount(async () => {
		try {
			const local = isLocalhost(data.appUrl) || isLocalhost(location.origin);
			const port = location.port;
			const redirectUri = `http://127.0.0.1${port ? ':' + port : ''}/oauth/callback`;
			const clientId = local
				? `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}`
				: `${data.appUrl}/oauth/client-metadata.json`;
			const client = await BrowserOAuthClient.load({
				clientId,
				handleResolver: 'https://bsky.social'
			});
			const result = await client.callback(new URLSearchParams(location.hash.slice(1)));

			// ネイティブフォームを POST し、サーバーが Set-Cookie + 302 /dashboard を
			// 同一レスポンスで返すことで、Cookie 設定とナビゲーションを原子的に行う。
			didInput.value = result.session.did;
			formEl.submit();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
		}
	});
</script>

<svelte:head>
	<title>{$t('app.name')}</title>
</svelte:head>

<!-- ネイティブ POST 用の隠しフォーム（サーバーアクションでセッション作成 + リダイレクト） -->
<form method="POST" bind:this={formEl} style="display:none">
	<input type="hidden" name="did" bind:this={didInput} />
</form>

<div class="max-w-sm mx-auto px-4 py-16 text-center">
	{#if error}
		<div class="bg-red-950 border border-red-800 rounded-xl p-6">
			<p class="text-red-300 text-sm mb-4">{$t('oauth.callback.error')}</p>
			<p class="text-red-500 text-xs font-mono">{error}</p>
			<a href="/signin" class="mt-4 inline-block text-sm text-primary-400 underline">
				{$t('signin.title')}
			</a>
		</div>
	{:else}
		<div class="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div>
		<p class="text-slate-400 text-sm">{$t('oauth.callback.loading')}</p>
	{/if}
</div>
