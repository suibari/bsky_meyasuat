<script lang="ts">
	import { t } from 'svelte-i18n';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageData } from './$types';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import OgThemePicker from '$lib/components/OgThemePicker.svelte';
	import OgBackgroundUploader from '$lib/components/OgBackgroundUploader.svelte';
	import { deleteAllRecordsInCollection } from '$lib/client/oauthClient.js';
	import { DEFAULT_OG_THEME_ID } from '$lib/theme.js';

	let { data }: { data: PageData } = $props();

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

	let requireNamedEnabled = $state(initialRequireNamedEnabled());
	let lastSavedRequireNamedEnabled = initialRequireNamedEnabled();

	function initialBoxName() {
		return data.user.boxName;
	}

	let boxName = $state(initialBoxName() ?? '');
	let lastSavedBoxName = initialBoxName();

	function initialOgColorTheme() {
		return data.user.colorTheme ?? DEFAULT_OG_THEME_ID;
	}

	function initialBackgroundPreviewUrl() {
		return data.backgroundImageUrl;
	}

	// 設定変更を自分のPDSへ反映する。設定の正データは config/self。
	async function syncConfigToPds(overrides: Partial<{
		notifyEnabled: boolean;
		shareHandleEnabled: boolean;
		requireNamedEnabled: boolean;
		boxName: string | null;
		colorTheme: string | null;
		backgroundImage: unknown;
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

	// OGP見た目(カラーテーマ・背景画像)
	let ogColorTheme = $state(initialOgColorTheme());
	let lastSavedOgColorTheme = initialOgColorTheme();
	let pendingBackgroundBlob = $state<Blob | null>(null);
	let backgroundRemoved = $state(false);
	let backgroundPreviewUrl = $state(initialBackgroundPreviewUrl());
	let boxSettingsSaving = $state(false);
	let boxSettingsError = $state('');
	let boxSettingsSaved = $state(false);
	let previewBoxUrl = $state<string | null>(null);
	let previewMessageUrl = $state<string | null>(null);
	let previewLoading = $state(false);
	let previewError = $state('');
	let cachedExistingBackgroundBlob: Blob | null = null;
	let cachedExistingBackgroundUrl: string | null = null;
	let previewDebounceTimer: ReturnType<typeof setTimeout> | undefined;
	let previewAbortController: AbortController | null = null;
	let previewRequestSeq = 0;
	let previewBackgroundVersion = $state(0);
	const previewCache = new Map<string, { box: string; message: string }>();

	function previewCacheKey() {
		const backgroundKey = backgroundRemoved
			? 'removed'
			: pendingBackgroundBlob
				? `pending:${previewBackgroundVersion}`
				: cachedExistingBackgroundBlob
					? `existing:${cachedExistingBackgroundUrl ?? 'cached'}`
					: data.backgroundImageUrl
						? `existing:${data.backgroundImageUrl}`
					: 'none';
		return `${ogColorTheme}:${backgroundKey}`;
	}

	async function fetchPreview(backgroundBlob: Blob | null, signal: AbortSignal): Promise<{ box: string; message: string }> {
		const fd = new FormData();
		fd.set('colorTheme', ogColorTheme);
		fd.set('variant', 'both');
		if (backgroundBlob) fd.set('background', backgroundBlob, 'background.jpg');
		const res = await fetch('/api/og/preview', { method: 'POST', body: fd, signal });
		if (!res.ok) {
			const err = new Error(`Preview request failed: ${res.status}`);
			(err as Error & { status?: number }).status = res.status;
			throw err;
		}
		return await res.json() as { box: string; message: string };
	}

	async function refreshOgPreview() {
		const key = previewCacheKey();
		previewAbortController?.abort();
		const controller = new AbortController();
		previewAbortController = controller;
		const requestSeq = ++previewRequestSeq;

		const cached = previewCache.get(key);
		if (cached) {
			previewBoxUrl = cached.box;
			previewMessageUrl = cached.message;
			previewError = '';
			previewLoading = false;
			return;
		}

		previewLoading = true;
		previewError = '';
		try {
			let backgroundBlob: Blob | null = pendingBackgroundBlob;
			if (!backgroundBlob && !backgroundRemoved) {
				if (cachedExistingBackgroundBlob) {
					backgroundBlob = cachedExistingBackgroundBlob;
				} else if (data.backgroundImageUrl && cachedExistingBackgroundUrl !== data.backgroundImageUrl) {
					const res = await fetch(data.backgroundImageUrl);
					cachedExistingBackgroundBlob = res.ok ? await res.blob() : null;
					cachedExistingBackgroundUrl = data.backgroundImageUrl;
					backgroundBlob = cachedExistingBackgroundBlob;
				}
			}

			const preview = await fetchPreview(backgroundBlob, controller.signal);
			if (requestSeq !== previewRequestSeq) return;
			previewCache.set(key, preview);
			previewBoxUrl = preview.box;
			previewMessageUrl = preview.message;
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			console.error('Failed to refresh OGP preview', e);
			const status = (e as Error & { status?: number }).status;
			previewError = status === 429 ? $t('settings.ogp_preview_rate_limited') : $t('settings.ogp_preview_error');
		} finally {
			if (requestSeq === previewRequestSeq) previewLoading = false;
		}
	}

	function scheduleOgPreview() {
		if (previewDebounceTimer) clearTimeout(previewDebounceTimer);
		previewDebounceTimer = setTimeout(refreshOgPreview, 500);
	}

	$effect(() => {
		// ogColorTheme / pendingBackgroundBlob / backgroundRemoved の変化に反応
		void ogColorTheme;
		void pendingBackgroundBlob;
		void backgroundRemoved;
		void previewBackgroundVersion;
		scheduleOgPreview();
	});

	function selectOgTheme(id: string) {
		ogColorTheme = id;
	}

	function onBackgroundChange(blob: Blob) {
		pendingBackgroundBlob = blob;
		backgroundRemoved = false;
		previewBackgroundVersion += 1;
		if (backgroundPreviewUrl && backgroundPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(backgroundPreviewUrl);
		backgroundPreviewUrl = URL.createObjectURL(blob);
	}

	function onBackgroundRemove() {
		pendingBackgroundBlob = null;
		backgroundRemoved = true;
		previewBackgroundVersion += 1;
		backgroundPreviewUrl = null;
	}

	const handleBoxSettingsSubmit: SubmitFunction = ({ formData }) => {
		boxSettingsError = '';
		boxSettingsSaved = false;
		boxSettingsSaving = true;
		const nextBoxName = ((formData.get('box_name') as string | null)?.trim() ?? '') || null;
		const nextRequireNamedEnabled = formData.get('require_named_enabled') === 'on';
		const previousBoxName = lastSavedBoxName;
		const previousRequireNamedEnabled = lastSavedRequireNamedEnabled;
		const previousOgColorTheme = lastSavedOgColorTheme;
		return async ({ result }) => {
			if (result.type === 'success') {
				try {
					let backgroundImageRef: unknown = undefined;
					if (backgroundRemoved) {
						backgroundImageRef = null;
					} else if (pendingBackgroundBlob) {
						const { restoreAgent, uploadBackgroundImageToPds } = await import('$lib/client/oauthClient.js');
						const agent = await restoreAgent(data.appUrl, data.user.did);
						backgroundImageRef = await uploadBackgroundImageToPds(agent, pendingBackgroundBlob);
					}
					await syncConfigToPds({
						boxName: nextBoxName,
						requireNamedEnabled: nextRequireNamedEnabled,
						colorTheme: ogColorTheme,
						...(backgroundImageRef !== undefined ? { backgroundImage: backgroundImageRef } : {})
					});
					lastSavedBoxName = nextBoxName;
					boxName = nextBoxName ?? '';
					lastSavedRequireNamedEnabled = nextRequireNamedEnabled;
					lastSavedOgColorTheme = ogColorTheme;
					if (backgroundRemoved) {
						cachedExistingBackgroundBlob = null;
						cachedExistingBackgroundUrl = null;
					} else if (pendingBackgroundBlob) {
						cachedExistingBackgroundBlob = pendingBackgroundBlob;
						cachedExistingBackgroundUrl = backgroundPreviewUrl;
					}
					pendingBackgroundBlob = null;
					backgroundRemoved = false;
					boxSettingsSaved = true;
				} catch (e) {
					console.error('Failed to save box settings', e);
					boxName = previousBoxName ?? '';
					requireNamedEnabled = previousRequireNamedEnabled;
					ogColorTheme = lastSavedOgColorTheme;
					boxSettingsError = $t('settings.box_settings_save_error');
				}
			} else {
				boxName = previousBoxName ?? '';
				requireNamedEnabled = previousRequireNamedEnabled;
				ogColorTheme = previousOgColorTheme;
				boxSettingsError = $t('settings.box_settings_save_error');
			}
			boxSettingsSaving = false;
		};
	};

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
					const { restoreAgent } = await import('$lib/client/oauthClient.js');
					const agent = await restoreAgent(data.appUrl, data.user.did);
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

</script>

<svelte:head>
	<title>{$t('settings.title')} - {$t('app.name')}</title>
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-8">
	<h1 class="text-xl font-bold text-slate-100 mb-6">{$t('settings.title')}</h1>

	<!-- めやすばこの設定 -->
	<section class="bg-slate-900 rounded-2xl border border-slate-800 p-5 mb-4">
		<h2 class="font-semibold text-slate-200 mb-4">{$t('settings.box_settings')}</h2>

		<form method="POST" action="?/saveBoxSettings" use:enhance={handleBoxSettingsSubmit} class="space-y-6">
			<div class="border-t border-slate-800 pt-5">
				<h3 class="text-base font-semibold text-slate-200 mb-3">{$t('settings.box_name')}</h3>
				<input
					type="text"
					name="box_name"
					maxlength="30"
					bind:value={boxName}
					placeholder={$t('settings.box_name_placeholder')}
					class="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
				/>
				<p class="text-xs text-slate-400 mt-1.5">{$t('settings.box_name_description')}</p>
			</div>

			<div class="border-t border-slate-800 pt-5">
				<h3 class="text-base font-semibold text-slate-200 mb-1">{$t('settings.ogp_appearance')}</h3>
				<p class="text-xs text-slate-400 mb-3">{$t('settings.ogp_appearance_description')}</p>
				<div class="mb-5">
					<p class="text-sm font-medium text-slate-300 mb-2">{$t('settings.ogp_color_theme')}</p>
					<OgThemePicker value={ogColorTheme} onSelect={selectOgTheme} />
				</div>

				<div class="mb-5">
					<p class="text-sm font-medium text-slate-300 mb-2">{$t('settings.ogp_background')}</p>
					<OgBackgroundUploader previewUrl={backgroundPreviewUrl} onChange={onBackgroundChange} onRemove={onBackgroundRemove} />
				</div>

				<div>
					<p class="text-sm font-medium text-slate-300 mb-2">{$t('settings.ogp_preview')}</p>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div class="relative aspect-1200/630 bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
							{#if previewBoxUrl}
								<img src={previewBoxUrl} alt="" class="w-full h-full object-cover" />
							{/if}
							{#if previewLoading}
								<div class="absolute inset-0 flex items-center justify-center bg-black/30"><Spinner /></div>
							{/if}
						</div>
						<div class="relative aspect-1200/630 bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
							{#if previewMessageUrl}
								<img src={previewMessageUrl} alt="" class="w-full h-full object-cover" />
							{/if}
							{#if previewLoading}
								<div class="absolute inset-0 flex items-center justify-center bg-black/30"><Spinner /></div>
							{/if}
						</div>
					</div>
					{#if previewError}
						<p class="mt-2 text-xs text-amber-400">{previewError}</p>
					{/if}
				</div>
			</div>

			<div class="border-t border-slate-800 pt-5">
				<label class="flex items-center justify-between gap-3 cursor-pointer">
					<div>
						<h3 class="text-base font-semibold text-slate-200">{$t('settings.require_named')}</h3>
						<p class="text-xs text-slate-400 mt-0.5">{$t('settings.require_named_description')}</p>
					</div>
					<ToggleSwitch name="require_named_enabled" bind:checked={requireNamedEnabled} disabled={boxSettingsSaving} />
				</label>
			</div>

			{#if boxSettingsError}
				<p class="mb-3 text-xs text-amber-400 bg-amber-950 rounded-lg px-3 py-2">{boxSettingsError}</p>
			{/if}
			{#if boxSettingsSaved && !boxSettingsError}
				<p class="mb-3 text-xs text-green-400 bg-green-950 rounded-lg px-3 py-2">{$t('settings.saved')}</p>
			{/if}
			<button
				type="submit"
				disabled={boxSettingsSaving}
				class="flex items-center gap-2 text-sm bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg transition-colors"
			>
				{#if boxSettingsSaving}<Spinner />{/if}
				{$t('settings.save')}
			</button>
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
