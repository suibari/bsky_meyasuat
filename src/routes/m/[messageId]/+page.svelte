<script lang="ts">
	import { t } from 'svelte-i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const ogUrl = $derived(`${data.appUrl}/api/og/${data.message.id}`);
	const pageUrl = $derived(`${data.appUrl}/m/${data.message.id}`);
	const replyText = $derived(pageUrl);
	const replyUrl = $derived(`https://bsky.app/intent/compose?text=${encodeURIComponent(replyText)}`);
	const xReplyUrl = $derived(`https://twitter.com/intent/tweet?text=${encodeURIComponent(pageUrl)}`);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, {
			year: 'numeric', month: 'long', day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>{data.creator.displayName ?? data.creator.handle} - {$t('app.name')}</title>
	<meta property="og:title" content="{data.creator.displayName ?? data.creator.handle} へのめやすあっと" />
	<meta property="og:description" content={data.message.body.slice(0, 100)} />
	<meta property="og:image" content={ogUrl} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:type" content="article" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content={ogUrl} />
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-10">
	<!-- クリエイター -->
	<div class="flex items-center gap-3 mb-6">
		{#if data.creator.avatarUrl}
			<img src={data.creator.avatarUrl} alt="" class="w-10 h-10 rounded-full object-cover" />
		{:else}
			<div class="w-10 h-10 rounded-full bg-primary-900 flex items-center justify-center text-primary-300 font-bold">
				{(data.creator.displayName ?? data.creator.handle)[0].toUpperCase()}
			</div>
		{/if}
		<div>
			<p class="font-semibold text-slate-100 text-sm">
				{data.creator.displayName ?? data.creator.handle}
			</p>
			<p class="text-xs text-slate-400">@{data.creator.handle}</p>
		</div>
	</div>

	<!-- メッセージ本文 -->
	<div class="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-sm mb-4">
		<p class="text-slate-200 leading-relaxed whitespace-pre-wrap">{data.message.body}</p>

		{#if data.message.imageUrls.length > 0}
			<div class="mt-4 flex flex-wrap gap-2">
				{#each data.message.imageUrls as url}
					<a href={url} target="_blank" rel="noopener noreferrer">
						<img src={url} alt="" class="rounded-lg max-h-48 max-w-full object-cover border border-slate-700" />
					</a>
				{/each}
			</div>
		{/if}

		<p class="mt-4 text-xs text-slate-600">
			{$t('message.sent_at', { values: { date: formatDate(data.message.createdAt) } })}
		</p>
	</div>

	<!-- 返信ボタン -->
	<div class="flex flex-col sm:flex-row gap-3">
		<a
			href={replyUrl}
			target="_blank"
			rel="noopener noreferrer"
			class="flex items-center justify-center gap-2 flex-1 bg-sky-500 hover:bg-sky-600 text-white font-medium py-3 rounded-xl transition-colors"
		>
			<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
			</svg>
			{$t('message.reply_on_bluesky')}
		</a>
		<a
			href={xReplyUrl}
			target="_blank"
			rel="noopener noreferrer"
			class="flex items-center justify-center gap-2 flex-1 bg-black hover:bg-gray-800 text-white font-medium py-3 rounded-xl transition-colors"
		>
			{$t('message.reply_on_x')}
		</a>
	</div>

	<!-- 自分も目安箱を作る -->
	<p class="mt-6 text-center text-xs text-slate-600">
		<a href="/" class="hover:text-primary-500 transition-colors">{$t('app.name')}</a> で自分の目安箱を作る
	</p>
</div>
