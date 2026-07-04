<script lang="ts">
	import { t } from 'svelte-i18n';
	import { OG_THEMES, type OgTheme } from '$lib/theme.js';

	let {
		value,
		onSelect,
		lang
	}: { value: string; onSelect: (id: string) => void; lang: 'ja' | 'en' } = $props();

	const categories: { key: OgTheme['category']; labelKey: string }[] = [
		{ key: 'masculine', labelKey: 'settings.ogp_theme_category_masculine' },
		{ key: 'feminine', labelKey: 'settings.ogp_theme_category_feminine' },
		{ key: 'other', labelKey: 'settings.ogp_theme_category_other' }
	];

	function themesFor(category: OgTheme['category']) {
		return OG_THEMES.filter((theme) => theme.category === category);
	}
</script>

<div class="space-y-4">
	{#each categories as category (category.key)}
		<div>
			<p class="text-xs text-slate-400 mb-2">{$t(category.labelKey)}</p>
			<div class="flex flex-wrap gap-3">
				{#each themesFor(category.key) as theme (theme.id)}
					<button
						type="button"
						onclick={() => onSelect(theme.id)}
						class="flex flex-col items-center gap-1.5 group"
						aria-pressed={value === theme.id}
					>
						<span
							class="w-10 h-10 rounded-full border-2 transition-colors"
							class:border-slate-100={value === theme.id}
							class:border-transparent={value !== theme.id}
							style={`background:${theme.swatch}`}
						></span>
						<span
							class="text-[11px] transition-colors"
							class:text-slate-100={value === theme.id}
							class:text-slate-400={value !== theme.id}
						>
							{lang === 'ja' ? theme.labelJa : theme.labelEn}
						</span>
					</button>
				{/each}
			</div>
		</div>
	{/each}
</div>
