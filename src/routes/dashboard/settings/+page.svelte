<script lang="ts">
	import { t } from 'svelte-i18n';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageData, ActionData } from './$types';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let followError = $state('');

	const handleNotifySubmit: SubmitFunction = ({ formData }) => {
		followError = '';
		const enabling = formData.get('notify_enabled') === 'on';

		return async ({ update }) => {
			if (enabling && data.botDid) {
				try {
					const [{ createOAuthClient }, { Agent }] = await Promise.all([
						import('$lib/client/oauthClient.js'),
						import('@atproto/api')
					]);
					const client = await createOAuthClient(data.appUrl);
					const session = await client.restore(data.user.did);
					const agent = new Agent(session);
					const profile = await agent.getProfile({ actor: data.botDid });
					if (!profile.data.viewer?.following) {
						await agent.follow(data.botDid);
					}
				} catch (e) {
					followError = e instanceof Error ? e.message : 'Unknown error';
				}
			}
			await update();
		};
	};
</script>

<svelte:head>
	<title>{$t('settings.title')} - {$t('app.name')}</title>
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-8">
	<h1 class="text-xl font-bold text-slate-100 mb-6">{$t('settings.title')}</h1>

	{#if form?.saved}
		<p class="mb-4 text-sm text-green-400 bg-green-950 rounded-lg px-3 py-2">{$t('settings.saved')}</p>
	{/if}

	<!-- めやすばこの名前 -->
	<section class="bg-slate-900 rounded-2xl border border-slate-800 p-5 mb-4">
		<h2 class="font-semibold text-slate-200 mb-3">{$t('settings.box_name')}</h2>
		<form method="POST" action="?/saveBoxName" use:enhance>
			<input
				type="text"
				name="box_name"
				maxlength="30"
				value={data.user.boxName ?? ''}
				placeholder={$t('settings.box_name_placeholder')}
				class="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
			/>
			<p class="text-xs text-slate-400 mt-1.5">{$t('settings.box_name_description')}</p>
			<button type="submit" class="mt-4 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors">
				{$t('settings.save')}
			</button>
		</form>
	</section>

	<!-- 通知 -->
	<section class="bg-slate-900 rounded-2xl border border-slate-800 p-5 mb-4">
		<h2 class="font-semibold text-slate-200 mb-3">{$t('settings.notifications')}</h2>
		<form method="POST" action="?/saveNotify" use:enhance={handleNotifySubmit}>
			<label class="flex items-center justify-between gap-3 cursor-pointer">
				<div>
					<p class="text-sm font-medium text-slate-300">{$t('settings.notify_enabled')}</p>
					<p class="text-xs text-slate-400 mt-0.5">{$t('settings.notify_description')}</p>
				</div>
				<ToggleSwitch name="notify_enabled" checked={data.user.notifyEnabled} />
			</label>
			{#if followError}
				<p class="mt-3 text-xs text-amber-400 bg-amber-950 rounded-lg px-3 py-2">{followError}</p>
			{/if}
			<button type="submit" class="mt-4 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors">
				{$t('settings.save')}
			</button>
		</form>
	</section>

	<!-- 言語 -->
	<section class="bg-slate-900 rounded-2xl border border-slate-800 p-5 mb-4">
		<h2 class="font-semibold text-slate-200 mb-3">{$t('settings.language')}</h2>
		<LanguageSwitcher lang={data.lang as 'ja' | 'en'} />
	</section>

	<!-- サインアウト -->
	<section class="bg-slate-900 rounded-2xl border border-slate-800 p-5">
		<h2 class="font-semibold text-slate-200 mb-3">{$t('nav.signout')}</h2>
		<form method="POST" action="/api/auth/logout">
			<button type="submit" class="text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
				{$t('nav.signout')}
			</button>
		</form>
	</section>
</div>
