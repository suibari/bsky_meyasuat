<script lang="ts">
	import QACard from './QACard.svelte';

	type Person = { avatarUrl: string | null; displayName: string | null; handle: string };

	type Item = {
		id: string;
		body: string;
		answer: string;
		createdAt: string;
		answeredAt: string;
		imageUrls: string[];
	};

	let {
		items,
		handle,
		title,
		creator = null,
		creatorHref = undefined
	}: {
		items: Item[];
		handle: string;
		title: string;
		creator?: Person | null;
		creatorHref?: string;
	} = $props();
</script>

{#if items.length > 0}
	<div class="mt-10">
		<h2 class="text-sm font-bold text-slate-300 mb-3">{title}</h2>
		<div class="space-y-2">
			{#each items as item (item.id)}
				<QACard
					href="/u/{handle}/m/{item.id}"
					body={item.body}
					answer={item.answer}
					createdAt={item.createdAt}
					answeredAt={item.answeredAt}
					imageUrls={item.imageUrls}
					{creator}
					{creatorHref}
					truncateLength={80}
				/>
			{/each}
		</div>
	</div>
{/if}
