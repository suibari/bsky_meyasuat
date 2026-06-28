<script lang="ts">
	import { t } from 'svelte-i18n';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();


</script>

<svelte:head>
	<title>{$t('settings.title')} - {$t('app.name')}</title>
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-8">
	<h1 class="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6">{$t('settings.title')}</h1>

	{#if form?.saved}
		<p class="mb-4 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 rounded-lg px-3 py-2">{$t('settings.saved')}</p>
	{/if}

	<!-- 通知 -->
	<section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 mb-4">
		<h2 class="font-semibold text-slate-800 dark:text-slate-200 mb-3">{$t('settings.notifications')}</h2>
		<form method="POST" action="?/saveNotify" use:enhance>
			<label class="flex items-start gap-3 cursor-pointer">
				<input
					type="checkbox"
					name="notify_enabled"
					checked={data.user.notifyEnabled}
					class="mt-0.5 w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
				/>
				<div>
					<p class="text-sm font-medium text-slate-700 dark:text-slate-300">{$t('settings.notify_enabled')}</p>
					<p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{$t('settings.notify_description')}</p>
				</div>
			</label>
			<button type="submit" class="mt-4 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors">
				{$t('settings.save')}
			</button>
		</form>
	</section>

	<!-- 言語 -->
	<section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
		<h2 class="font-semibold text-slate-800 dark:text-slate-200 mb-3">{$t('settings.language')}</h2>
		<LanguageSwitcher lang={data.lang as 'ja' | 'en'} />
	</section>
</div>
