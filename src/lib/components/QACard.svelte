<script lang="ts">
	import { t } from 'svelte-i18n';
	import type { Snippet } from 'svelte';

	type Person = { avatarUrl: string | null; displayName: string | null; handle: string };

	let {
		body,
		answer = null,
		sender = null,
		senderHref = undefined,
		creator = null,
		creatorHref = undefined,
		answererLabel = undefined,
		imageUrls = [],
		createdAt = undefined,
		answeredAt = undefined,
		href = undefined,
		truncateLength = undefined,
		unread = false,
		questionActions = undefined,
		answerActions = undefined,
		expandedPane = undefined,
		expandedPaneOpen = false
	}: {
		body: string;
		answer?: string | null;
		sender?: Person | null;
		senderHref?: string;
		creator?: Person | null;
		creatorHref?: string;
		answererLabel?: string;
		imageUrls?: string[];
		createdAt?: string;
		answeredAt?: string | null;
		href?: string;
		truncateLength?: number;
		unread?: boolean;
		questionActions?: Snippet;
		answerActions?: Snippet;
		expandedPane?: Snippet;
		expandedPaneOpen?: boolean;
	} = $props();

	function truncate(text: string, max: number): string {
		return text.length > max ? text.slice(0, max) + '…' : text;
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	const displayBody = $derived(truncateLength ? truncate(body, truncateLength) : body);
	const displayAnswer = $derived(
		answer && truncateLength ? truncate(answer, truncateLength) : answer
	);
	let failedImageUrls = $state<string[]>([]);
	const hasExpiredImages = $derived(failedImageUrls.length > 0);

	function markImageFailed(url: string): void {
		if (failedImageUrls.includes(url)) return;
		failedImageUrls = [...failedImageUrls, url];
	}

	function isImageFailed(url: string): boolean {
		return failedImageUrls.includes(url);
	}

	const thumbClass = $derived(
		truncateLength
			? 'rounded-lg max-h-20 max-w-full object-cover border border-slate-700'
			: 'rounded-lg max-h-48 max-w-full object-cover border border-slate-700'
	);
</script>

{#snippet personRow(person: Person, personHref?: string)}
	<div class="flex items-center gap-2 mb-2">
		{#if personHref}
			<a href={personHref}>
				{#if person.avatarUrl}
					<img src={person.avatarUrl} alt="" class="w-6 h-6 rounded-full object-cover" />
				{:else}
					<div
						class="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs"
					>
						{(person.displayName ?? person.handle)[0].toUpperCase()}
					</div>
				{/if}
			</a>
		{:else if person.avatarUrl}
			<img src={person.avatarUrl} alt="" class="w-6 h-6 rounded-full object-cover" />
		{:else}
			<div
				class="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs"
			>
				{(person.displayName ?? person.handle)[0].toUpperCase()}
			</div>
		{/if}
		<span class="text-xs text-slate-400">
			<span class="font-medium text-slate-300">{person.displayName ?? person.handle}</span>
			(@{person.handle})
		</span>
	</div>
{/snippet}

{#snippet content()}
	<div class="flex items-start gap-3">
		{#if unread}
			<span class="shrink-0 w-2 h-2 rounded-full bg-primary-500 mt-1.5"></span>
		{/if}
		<div class="flex-1 min-w-0">
			{#if sender}
				{@render personRow(sender, senderHref)}
			{/if}
			<p class="text-slate-200 leading-relaxed whitespace-pre-wrap">{displayBody}</p>
		</div>
	</div>

	{#if imageUrls.length > 0}
		<div class="mt-4 flex flex-wrap gap-2">
			{#each imageUrls as url}
				{#if !isImageFailed(url)}
					{#if href}
						<img src={url} alt="" class={thumbClass} onerror={() => markImageFailed(url)} />
					{:else}
						<a href={url} target="_blank" rel="noopener noreferrer">
							<img src={url} alt="" class={thumbClass} onerror={() => markImageFailed(url)} />
						</a>
					{/if}
				{/if}
			{/each}
		</div>
		{#if hasExpiredImages}
			<p class="mt-2 text-xs text-slate-500">{$t('message.images_expired')}</p>
		{/if}
	{/if}

	{#if createdAt}
		<p class="mt-4 text-xs text-slate-600">
			{$t('message.sent_at', { values: { date: formatDate(createdAt) } })}
		</p>
	{/if}

	{#if questionActions}
		<div class="mt-3 flex flex-wrap items-center justify-end gap-2">
			{@render questionActions()}
		</div>
	{/if}

	{#if expandedPane && expandedPaneOpen}
		<hr class="my-4 border-slate-800" />
		{@render expandedPane()}
	{/if}

	{#if displayAnswer}
		<hr class="my-4 border-slate-800" />
		{#if creator}
			{@render personRow(creator, creatorHref)}
		{:else if answererLabel}
			<p class="text-xs font-medium text-primary-400 mb-1">{answererLabel}</p>
		{/if}
		<p class="text-primary-300 leading-relaxed whitespace-pre-wrap">
			{#if !creator && !answererLabel}A: {/if}{displayAnswer}
		</p>
		{#if answeredAt}
			<p class="mt-4 text-xs text-slate-600">
				{$t('message.answered_at', { values: { date: formatDate(answeredAt) } })}
			</p>
		{/if}

		{#if answerActions}
			<div class="mt-3 flex flex-wrap items-center justify-end gap-2">
				{@render answerActions()}
			</div>
		{/if}
	{/if}
{/snippet}

{#if href}
	<a
		{href}
		class="block relative bg-slate-900 rounded-2xl border {unread
			? 'border-primary-700'
			: 'border-slate-800'} p-6 shadow-sm hover:border-primary-700 transition-colors"
	>
		{@render content()}
	</a>
{:else}
	<div
		class="relative bg-slate-900 rounded-2xl border {unread
			? 'border-primary-700'
			: 'border-slate-800'} p-6 shadow-sm"
	>
		{@render content()}
	</div>
{/if}
