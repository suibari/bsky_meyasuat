<script lang="ts">
	import { t } from 'svelte-i18n';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let copied = $state(false);
	const boxUrl = $derived(`${data.appUrl}/u/${data.user?.handle}`);

	async function copyUrl() {
		await navigator.clipboard.writeText(boxUrl);
		copied = true;
		setTimeout(() => { copied = false; }, 2000);
	}

	async function markRead(id: string) {
		await fetch(`/api/messages/${id}/read`, { method: 'PATCH' });
		await invalidateAll();
	}

	function replyUrl(handle: string, messageId: string): string {
		const text = `${data.appUrl}/m/${messageId}`;
		return `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
	}

	function xReplyUrl(messageId: string): string {
		return `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${data.appUrl}/m/${messageId}`)}`;
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	}
</script>

<svelte:head>
	<title>{$t('dashboard.title')} - {$t('app.name')}</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-8">
	<!-- URL シェア -->
	<div class="bg-primary-950 border border-primary-800 rounded-2xl p-4 mb-6 flex items-center gap-3">
		<div class="flex-1 min-w-0">
			<p class="text-xs text-primary-400 font-medium mb-0.5">{$t('dashboard.your_url')}</p>
			<p class="text-sm text-slate-300 truncate font-mono">{boxUrl}</p>
		</div>
		<button
			onclick={copyUrl}
			class="shrink-0 text-sm bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg transition-colors"
		>
			{copied ? $t('dashboard.copied') : $t('dashboard.copy')}
		</button>
	</div>

	<div class="flex items-center justify-between mb-4">
		<h1 class="text-xl font-bold text-slate-100">{$t('dashboard.title')}</h1>
		{#if data.unreadCount > 0}
			<span class="text-xs bg-accent-500 text-white px-2.5 py-1 rounded-full font-medium">
				{$t('dashboard.unread', { values: { count: data.unreadCount } })}
			</span>
		{/if}
	</div>

	{#if data.messages.length === 0}
		<div class="text-center py-16 text-slate-600">
			<p class="text-4xl mb-3">📭</p>
			<p class="font-medium">{$t('dashboard.empty')}</p>
			<p class="text-sm mt-1">{$t('dashboard.empty_sub')}</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each data.messages as msg (msg.id)}
				<div class="bg-slate-900 rounded-2xl border {msg.isRead ? 'border-slate-800' : 'border-primary-700'} p-5 shadow-sm">
					<div class="flex items-start justify-between gap-3 mb-3">
						<p class="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap flex-1">{msg.body}</p>
						{#if !msg.isRead}
							<span class="shrink-0 w-2 h-2 rounded-full bg-primary-500 mt-1.5"></span>
						{/if}
					</div>

					{#if msg.imageUrls.length > 0}
						<div class="flex gap-2 mb-3 flex-wrap">
							{#each msg.imageUrls as url}
								<a href={url} target="_blank" rel="noopener noreferrer">
									<img src={url} alt="" class="w-24 h-24 object-cover rounded-lg border border-slate-700" />
								</a>
							{/each}
						</div>
					{/if}

					<div class="flex flex-wrap items-center justify-between gap-y-2">
						<p class="text-xs text-slate-600">{formatDate(msg.createdAt)}</p>
						<div class="flex flex-wrap items-center gap-2">
							{#if !msg.isRead}
								<button
									onclick={() => markRead(msg.id)}
									class="text-xs text-slate-400 hover:text-slate-200 transition-colors"
								>
									{$t('dashboard.mark_read')}
								</button>
							{/if}
							<a
								href={replyUrl(data.user?.handle ?? '', msg.id)}
								target="_blank"
								rel="noopener noreferrer"
								class="text-xs bg-sky-500 hover:bg-sky-600 text-white px-3 py-1.5 rounded-lg transition-colors"
							>
								{$t('dashboard.reply')}
							</a>
							<a
								href={xReplyUrl(msg.id)}
								target="_blank"
								rel="noopener noreferrer"
								class="text-xs bg-black hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg transition-colors"
							>
								{$t('dashboard.reply_on_x')}
							</a>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- ページネーション -->
		{#if data.messages.length === 20}
			<div class="mt-6 text-center">
				<a href="?page={data.page + 1}" class="text-sm text-primary-400 hover:underline">
					次のページ →
				</a>
			</div>
		{/if}
	{/if}
</div>
