<script lang="ts">
	import { t } from 'svelte-i18n';
	import { blueskyShareUrl, xShareUrl } from '$lib/utils/share.js';

	let { ogImageUrl, shareUrl, onClose }: { ogImageUrl: string; shareUrl: string; onClose: () => void } = $props();

	let linkCopied = $state(false);
	let warmingOg = $state(false);
	let ogWarmed = $state(false);

	function wait(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async function warmOg(): Promise<void> {
		if (ogWarmed || warmingOg) return;
		warmingOg = true;
		try {
			await Promise.race([
				fetch(ogImageUrl, { cache: 'reload' }),
				wait(1800)
			]);
		} catch {
			// warming 失敗時もシェア自体は続行する
		} finally {
			ogWarmed = true;
			warmingOg = false;
		}
	}

	$effect(() => {
		void warmOg();
	});

	async function openShareIntent(intentUrl: string): Promise<void> {
		const shareWindow = window.open('about:blank', '_blank', 'noopener,noreferrer');
		if (!shareWindow) return;
		await warmOg();
		shareWindow.location.href = intentUrl;
	}

	async function copyShareLink() {
		await navigator.clipboard.writeText(shareUrl);
		linkCopied = true;
		setTimeout(() => { linkCopied = false; }, 2000);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<dialog
	open
	onclick={(e) => { if ((e.target as HTMLElement).tagName === 'DIALOG') onClose(); }}
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 w-full h-full max-w-none max-h-none p-4 m-0 border-none"
>
	<div class="bg-slate-900 rounded-2xl shadow-xl max-w-sm w-full p-6 relative">
		<h2 class="text-base font-bold text-slate-100 mb-4 text-center">{$t('dashboard.share_title')}</h2>

		<img
			src={ogImageUrl}
			alt="OGP"
			class="w-full h-auto rounded-xl border border-slate-700 mb-6"
		/>

		<div class="flex flex-col gap-3 mb-2">
			<a
				href={blueskyShareUrl(shareUrl)}
				onclick={async (e) => {
					e.preventDefault();
					await openShareIntent(blueskyShareUrl(shareUrl));
				}}
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center justify-center gap-2 w-full bg-sky-500 hover:bg-sky-600 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
			>
				{$t('dashboard.share_on_bluesky')}
			</a>
			<a
				href={xShareUrl(shareUrl)}
				onclick={async (e) => {
					e.preventDefault();
					await openShareIntent(xShareUrl(shareUrl));
				}}
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center justify-center gap-2 w-full bg-black hover:bg-gray-800 border border-slate-700 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
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
