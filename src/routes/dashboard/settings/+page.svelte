<script lang="ts">
	import { t } from 'svelte-i18n';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageData, ActionData } from './$types';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
	import { deleteAllRecordsInCollection } from '$lib/client/oauthClient.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let followError = $state('');

	let showDeleteModal = $state(false);
	let deleting = $state(false);
	let deleteError = $state('');

	function openDeleteModal() {
		deleteError = '';
		showDeleteModal = true;
	}

	function closeDeleteModal() {
		if (deleting) return;
		showDeleteModal = false;
		deleteError = '';
	}

	function onDeleteDialogClick(e: MouseEvent) {
		if (deleting) return;
		if ((e.target as HTMLElement).tagName === 'DIALOG') closeDeleteModal();
	}

	async function deleteBox() {
		if (deleting) return;
		deleting = true;
		deleteError = '';

		try {
			// 1. 自分のPDSレコードを削除（best-effort）
			try {
				await deleteAllRecordsInCollection(data.appUrl, data.user.did, 'com.suibari.meyasuat.answer');
				await deleteAllRecordsInCollection(data.appUrl, data.user.did, 'com.suibari.meyasuat.question');
			} catch (e) {
				console.error('Failed to delete PDS records', e);
			}

			// 2. サーバー側のデータを削除
			const res = await fetch('/api/account', { method: 'DELETE' });
			if (!res.ok) {
				deleteError = $t('settings.delete_box_error');
				deleting = false;
				return;
			}

			// 3. ランディングへ
			await goto('/');
			location.reload();
		} catch {
			deleteError = $t('settings.delete_box_error');
			deleting = false;
		}
	}

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
			<button type="submit" class="mt-4 text-sm bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition-colors">
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
			<button type="submit" class="mt-4 text-sm bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition-colors">
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
	<section class="bg-slate-900 rounded-2xl border border-slate-800 p-5 mb-4">
		<h2 class="font-semibold text-slate-200 mb-3">{$t('nav.signout')}</h2>
		<form method="POST" action="/api/auth/logout">
			<button type="submit" class="text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
				{$t('nav.signout')}
			</button>
		</form>
	</section>

	<!-- 質問箱の削除（危険ゾーン） -->
	<section class="bg-slate-900 rounded-2xl border border-red-900/60 p-5">
		<h2 class="font-semibold text-red-400 mb-3">{$t('settings.delete_box')}</h2>
		<p class="text-xs text-slate-400 mb-4">{$t('settings.delete_box_description')}</p>
		<button
			type="button"
			onclick={openDeleteModal}
			class="text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
		>
			{$t('settings.delete_box_button')}
		</button>
	</section>
</div>

<!-- 削除確認モーダル -->
{#if showDeleteModal}
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<dialog
	open
	onclick={onDeleteDialogClick}
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 w-full h-full max-w-none max-h-none p-4 m-0 border-none"
>
	<div class="bg-slate-900 rounded-2xl shadow-xl max-w-sm w-full p-6 relative">
		<h2 class="text-base font-bold text-slate-100 mb-3">{$t('settings.delete_box_confirm_title')}</h2>
		<p class="text-sm text-slate-400 mb-4">{$t('settings.delete_box_confirm')}</p>
		{#if deleteError}
			<p class="mb-4 text-sm text-red-400 bg-red-950/50 rounded-lg px-3 py-2 border border-red-900/50">{deleteError}</p>
		{/if}
		<div class="flex justify-end gap-2">
			<button
				onclick={closeDeleteModal}
				disabled={deleting}
				class="text-sm text-slate-400 hover:text-slate-200 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
			>
				{$t('dashboard.delete_cancel')}
			</button>
			<button
				onclick={deleteBox}
				disabled={deleting}
				class="flex items-center gap-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-70 text-white px-4 py-2 rounded-lg transition-colors"
			>
				{#if deleting}
					<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
					{$t('settings.delete_box_deleting')}
				{:else}
					{$t('settings.delete_box_button')}
				{/if}
			</button>
		</div>
	</div>
</dialog>
{/if}
