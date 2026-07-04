<script lang="ts">
	import { OG_THEMES } from '$lib/theme.js';

	let {
		value,
		onSelect
	}: { value: string; onSelect: (id: string) => void } = $props();
</script>

<div class="flex flex-wrap gap-3">
	{#each OG_THEMES as theme, index (theme.id)}
		<button
			type="button"
			onclick={() => onSelect(theme.id)}
			class="rounded-full p-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
			class:ring-2={value === theme.id}
			class:ring-slate-100={value === theme.id}
			class:ring-offset-2={value === theme.id}
			class:ring-offset-slate-900={value === theme.id}
			aria-pressed={value === theme.id}
			aria-label={`テーマ ${index + 1}`}
		>
			<span
				class="block w-10 h-10 rounded-full border-2 transition-colors"
				class:border-slate-100={value === theme.id}
				class:border-slate-700={value !== theme.id}
				style={`background:${theme.swatch}`}
			></span>
		</button>
	{/each}
</div>
