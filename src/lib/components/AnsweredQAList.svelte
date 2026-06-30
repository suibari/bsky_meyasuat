<script lang="ts">
	type Item = { id: string; body: string; answer: string; answeredAt: string };

	let { items, handle, title }: { items: Item[]; handle: string; title: string } = $props();

	function truncate(text: string, max: number): string {
		return text.length > max ? text.slice(0, max) + '…' : text;
	}
</script>

{#if items.length > 0}
	<div class="mt-10">
		<h2 class="text-sm font-bold text-slate-300 mb-3">{title}</h2>
		<div class="space-y-2">
			{#each items as item (item.id)}
				<a
					href="/u/{handle}/m/{item.id}"
					class="block bg-slate-900 rounded-xl border border-slate-800 p-4 hover:border-primary-700 transition-colors"
				>
					<p class="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{truncate(item.body, 80)}</p>
					<p class="text-primary-400 text-sm leading-relaxed whitespace-pre-wrap mt-1">A: {truncate(item.answer, 80)}</p>
				</a>
			{/each}
		</div>
	</div>
{/if}
