<script lang="ts">
	import { t } from 'svelte-i18n';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageData, ActionData } from './$types';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { deleteAllRecordsInCollection } from '$lib/client/oauthClient.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	function initialNotifyEnabled() {
		return data.user.notifyEnabled;
	}

	let followError = $state('');
	let notifyForm: HTMLFormElement;
	let notifyEnabled = $state(initialNotifyEnabled());
	let notifySaving = $state(false);
	let lastSavedNotifyEnabled = initialNotifyEnabled();

	function initialRequireNamedEnabled() {
		return data.user.requireNamedEnabled;
	}

	let requireNamedForm: HTMLFormElement;
	let requireNamedEnabled = $state(initialRequireNamedEnabled());
	let requireNamedSaving = $state(false);
	let requireNamedError = $state('');
	let lastSavedRequireNamedEnabled = initialRequireNamedEnabled();

	function initialBoxName() {
		return data.user.boxName;
	}

	let lastSavedBoxName = initialBoxName();

	// 設定変更を自分のPDSへ反映する。設定の正データは config/self。
	async function syncConfigToPds(overrides: Partial<{
		notifyEnabled: boolean;
		shareHandleEnabled: boolean;
		requireNamedEnabled: boolean;
		boxName: string | null;
	}>) {
		try {
			const { putConfigRecord } = await import('$lib/client/oauthClient.js');
			await putConfigRecord(data.appUrl, data.user.did, {
				notifyEnabled: lastSavedNotifyEnabled,
				shareHandleEnabled: data.user.shareHandleEnabled,
				requireNamedEnabled: lastSavedRequireNamedEnabled,
				boxName: lastSavedBoxName,
				...overrides
			});
		} catch (e) {
			console.error('Failed to sync config to PDS', e);
			throw e;
		}
	}

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
				await deleteAllRecordsInCollection(data.appUrl, data.user.did, 'com.suibari.meyasuat.rejection');
				await deleteAllRecordsInCollection(data.appUrl, data.user.did, 'com.suibari.meyasuat.config');
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
		const previous = lastSavedNotifyEnabled;
		notifySaving = true;

		return async ({ result }) => {
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

			if (result.type === 'success') {
				try {
					await syncConfigToPds({ notifyEnabled: enabling });
					lastSavedNotifyEnabled = enabling;
				} catch {
					notifyEnabled = previous;
					followError = $t('settings.notify_save_error');
				}
			} else {
				notifyEnabled = previous;
				followError = result.type === 'failure' ? $t('settings.notify_save_error') : 'Unknown error';
			}
			notifySaving = false;
		};
	};

	function onNotifyChange() {
		if (notifySaving) return;
		notifyForm.requestSubmit();
	}

	const handleRequireNamedSubmit: SubmitFunction = ({ formData }) => {
		requireNamedError = '';
		const enabling = formData.get('require_named_enabled') === 'on';
		const previous = lastSavedRequireNamedEnabled;
		requireNamedSaving = true;

		return async ({ result }) => {
			if (result.type === 'success') {
				try {
					await syncConfigToPds({ requireNamedEnabled: enabling });
					lastSavedRequireNamedEnabled = enabling;
				} catch {
					requireNamedEnabled = previous;
					requireNamedError = $t('settings.require_named_save_error');
				}
			} else {
				requireNamedEnabled = previous;
				requireNamedError = $t('settings.require_named_save_error');
			}
			requireNamedSaving = false;
		};
	};

	function onRequireNamedChange() {
		if (requireNamedSaving) return;
		requireNamedForm.requestSubmit();
	}

	const handleBoxNameSubmit: SubmitFunction = ({ formData }) => {
		const raw = (formData.get('box_name') as string | null)?.trim() ?? '';
		return async ({ result, update }) => {
			if (result.type === 'success') {
				const nextBoxName = raw || null;
				await syncConfigToPds({ boxName: nextBoxName }).then(() => {
					lastSavedBoxName = nextBoxName;
				}).catch(() => {});
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
		<form method="POST" action="?/saveBoxName" use:enhance={handleBoxNameSubmit}>
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

	<!-- 記名必須化 -->
	<section class="bg-slate-900 rounded-2xl border border-slate-800 p-5 mb-4">
		<h2 class="font-semibold text-slate-200 mb-3">{$t('settings.require_named')}</h2>
		<form method="POST" action="?/saveRequireNamed" bind:this={requireNamedForm} use:enhance={handleRequireNamedSubmit}>
			<label class="flex items-center justify-between gap-3 cursor-pointer">
				<div>
					<p class="text-sm font-medium text-slate-300">{$t('settings.require_named_enabled')}</p>
					<p class="text-xs text-slate-400 mt-0.5">{$t('settings.require_named_description')}</p>
				</div>
				<div class="flex items-center gap-2">
					{#if requireNamedSaving}
						<Spinner />
					{/if}
					<ToggleSwitch name="require_named_enabled" bind:checked={requireNamedEnabled} disabled={requireNamedSaving} onchange={onRequireNamedChange} />
				</div>
			</label>
			{#if requireNamedError}
				<p class="mt-3 text-xs text-amber-400 bg-amber-950 rounded-lg px-3 py-2">{requireNamedError}</p>
			{/if}
		</form>
	</section>

	<!-- 通知 -->
	<section class="bg-slate-900 rounded-2xl border border-slate-800 p-5 mb-4">
		<h2 class="font-semibold text-slate-200 mb-3">{$t('settings.notifications')}</h2>
		<form method="POST" action="?/saveNotify" bind:this={notifyForm} use:enhance={handleNotifySubmit}>
			<label class="flex items-center justify-between gap-3 cursor-pointer">
				<div>
					<p class="text-sm font-medium text-slate-300">{$t('settings.notify_enabled')}</p>
					<p class="text-xs text-slate-400 mt-0.5">{$t('settings.notify_description')}</p>
				</div>
				<div class="flex items-center gap-2">
					{#if notifySaving}
						<Spinner />
					{/if}
					<ToggleSwitch name="notify_enabled" bind:checked={notifyEnabled} disabled={notifySaving} onchange={onNotifyChange} />
				</div>
			</label>
			{#if followError}
				<p class="mt-3 text-xs text-amber-400 bg-amber-950 rounded-lg px-3 py-2">{followError}</p>
			{/if}
		</form>
	</section>

	<!-- 言語 -->
	<section class="bg-slate-900 rounded-2xl border border-slate-800 p-5 mb-4">
		<h2 class="font-semibold text-slate-200 mb-3">{$t('settings.language')}</h2>
		<LanguageSwitcher lang={data.lang as 'ja' | 'en'} />
	</section>

	<!-- 法的文書 -->
	<section class="bg-slate-900 rounded-2xl border border-slate-800 p-5 mb-4">
		<h2 class="font-semibold text-slate-200 mb-3">{$t('settings.legal_title')}</h2>
		<div class="flex flex-wrap gap-3 text-sm">
			<a href="/terms" class="text-primary-400 underline underline-offset-2 transition-colors hover:text-primary-300">
				{$t('settings.legal_terms_link')}
			</a>
			<a href="/privacy" class="text-primary-400 underline underline-offset-2 transition-colors hover:text-primary-300">
				{$t('settings.legal_privacy_link')}
			</a>
		</div>
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
					<Spinner />
					{$t('settings.delete_box_deleting')}
				{:else}
					{$t('settings.delete_box_button')}
				{/if}
			</button>
		</div>
	</div>
</dialog>
{/if}
