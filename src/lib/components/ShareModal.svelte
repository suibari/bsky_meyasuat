<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from 'svelte-i18n';
	import { xShareUrl } from '$lib/utils/share.js';
	import Spinner from '$lib/components/Spinner.svelte';

	let {
		ogImageUrl,
		messageId,
		shareUrl,
		onClose,
		title,
		did,
		handle,
		appUrl,
		embedTitle,
		embedDescription
	}: {
		ogImageUrl: string;
		messageId?: string;
		shareUrl: string;
		onClose: () => void;
		title?: string;
		did: string;
		handle: string;
		appUrl: string;
		embedTitle: string;
		embedDescription: string;
	} = $props();

	const BLUESKY_MAX_CHARS = 300;

	let linkCopied = $state(false);
	let imageLoaded = $state(false);
	let postText = $state('');
	let posting = $state(false);
	let postResult = $state<{ postUrl?: string } | null>(null);
	let postError = $state(false);
	let imageSrc = $state<string | null>(null);
	let ogImage: Promise<Blob> | null = null;

	// 開いたときにOGP画像をブラウザで生成してR2へ保存する。これでX等のクローラーが
	// /api/og/... を取りに来てもサーバーで描画せずに済む(WorkersのCPU上限対策)。
	// 生成に失敗したらサーバーの画像(背景なしのフォールバックになりうる)を表示・投稿に使う。
	async function loadOgImage(): Promise<Blob> {
		try {
			const { publishOgImage } = await import('$lib/client/og.js');
			return await publishOgImage(handle, messageId);
		} catch (e) {
			console.error('Failed to publish OGP image', e);
			const res = await fetch(ogImageUrl);
			if (!res.ok) throw new Error('Failed to fetch OGP image');
			return await res.blob();
		}
	}

	onMount(() => {
		let objectUrl: string | null = null;
		ogImage = loadOgImage();
		ogImage
			.then((blob) => {
				objectUrl = URL.createObjectURL(blob);
				imageSrc = objectUrl;
			})
			.catch(() => {
				imageSrc = ogImageUrl;
			});
		return () => {
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	});

	async function copyShareLink() {
		await navigator.clipboard.writeText(shareUrl);
		linkCopied = true;
		setTimeout(() => { linkCopied = false; }, 2000);
	}

	async function handlePost() {
		posting = true;
		postError = false;
		postResult = null;
		try {
			const { postShareToBluesky } = await import('$lib/client/oauthClient.js');
			const result = await postShareToBluesky(appUrl, did, postText, {
				url: shareUrl,
				image: await (ogImage ?? loadOgImage()),
				title: embedTitle,
				description: embedDescription
			});
			postResult = { postUrl: result.postUrl };
		} catch (e) {
			console.error('Failed to post share to Bluesky', e);
			postError = true;
		} finally {
			posting = false;
		}
	}

	async function relogin() {
		const { createOAuthClient } = await import('$lib/client/oauthClient.js');
		const client = await createOAuthClient(appUrl);
		await client.signIn(handle, { state: window.location.pathname });
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<dialog
	open
	onclick={(e) => { if ((e.target as HTMLElement).tagName === 'DIALOG') onClose(); }}
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 w-full h-full max-w-none max-h-none p-4 m-0 border-none"
>
	<div class="bg-slate-900 rounded-2xl shadow-xl max-w-sm w-full p-6 relative">
		<h2 class="text-base font-bold text-slate-100 mb-4 text-center">{title ?? $t('dashboard.share_title')}</h2>

		<div class="relative w-full aspect-1200/630 rounded-xl border border-slate-700 mb-6 overflow-hidden bg-slate-800">
			{#if !imageLoaded}
				<div class="absolute inset-0 animate-pulse bg-slate-700"></div>
			{/if}
			{#if imageSrc}
				<img
					src={imageSrc}
					alt="OGP"
					onload={() => imageLoaded = true}
					onerror={() => imageLoaded = true}
					class="w-full h-full object-cover transition-opacity duration-300"
					class:opacity-0={!imageLoaded}
					class:opacity-100={imageLoaded}
				/>
			{/if}
		</div>

		<div class="mb-4">
			<textarea
				bind:value={postText}
				placeholder={$t('dashboard.share_post_placeholder')}
				rows="3"
				class="w-full resize-none rounded-xl border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-cyan-600"
			></textarea>
			<div class="flex items-center justify-between text-xs mt-1">
				<span class="text-slate-500">{$t('dashboard.share_post_bluesky_only')}</span>
				<span class:text-red-500={postText.length > BLUESKY_MAX_CHARS} class:text-slate-500={postText.length <= BLUESKY_MAX_CHARS}>
					{postText.length} / {BLUESKY_MAX_CHARS}
				</span>
			</div>
		</div>

		{#if postResult}
			<div class="mb-4 text-center text-sm text-emerald-400">
				{$t('dashboard.post_success')}
				{#if postResult.postUrl}
					<a href={postResult.postUrl} target="_blank" rel="noopener noreferrer" class="underline underline-offset-2 hover:text-emerald-300">
						{$t('dashboard.view_post')}
					</a>
				{/if}
			</div>
		{/if}

		{#if postError}
			<div class="mb-4 flex flex-col items-center gap-2 text-center text-sm text-red-400">
				<span>{$t('dashboard.post_error')}</span>
				<button onclick={relogin} class="text-slate-300 underline underline-offset-2 hover:text-slate-100">
					{$t('dashboard.relogin_cta')}
				</button>
			</div>
		{/if}

		<div class="flex flex-col gap-3 mb-2">
			<button
				onclick={handlePost}
				disabled={posting || postText.length > BLUESKY_MAX_CHARS}
				class="flex items-center justify-center gap-2 w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
			>
				{#if posting}
					<Spinner />
					{$t('dashboard.answer_sending')}
				{:else}
					{$t('dashboard.share_on_bluesky')}
				{/if}
			</button>
			<a
				href={xShareUrl(shareUrl)}
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center justify-center gap-2 w-full bg-black hover:bg-neutral-900 border border-neutral-700 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
			>
				{$t('dashboard.share_on_x')}
			</a>
			<button
				onclick={copyShareLink}
				class="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
			>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
					<path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
					<path d="M14 11a5 5 0 0 0-7.07 0l-2.83 2.83a5 5 0 0 0 7.07 7.07l1.5-1.5" />
				</svg>
				{linkCopied ? $t('dashboard.link_copied') : $t('dashboard.copy_link')}
			</button>
		</div>

		<div class="mt-4 text-center">
			<button
				onclick={onClose}
				class="text-sm text-slate-400 hover:text-slate-200 px-4 py-2 transition-colors"
			>
				{$t('dashboard.close')}
			</button>
		</div>
	</div>
</dialog>
