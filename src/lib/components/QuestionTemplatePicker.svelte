<script lang="ts">
	import { locale, t } from 'svelte-i18n';
	import { questionCategories } from '$lib/questionTemplates';

	let { value = $bindable('') }: { value?: string } = $props();

	const lang = $derived($locale?.startsWith('en') ? 'en' : 'ja');

	function pick(category: (typeof questionCategories)[number]) {
		const list = category.templates[lang];
		value = list[Math.floor(Math.random() * list.length)];
	}
</script>

<div class="mb-4">
	<p class="text-xs text-slate-400 mb-2">{$t('submit.template_label')}</p>
	<div class="flex flex-wrap gap-2">
		{#each questionCategories as category (category.id)}
			<button
				type="button"
				onclick={() => pick(category)}
				class="text-xs sm:text-sm px-3 py-1.5 rounded-full border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors whitespace-nowrap"
			>
				{category.emoji} {category.label[lang]}
			</button>
		{/each}
	</div>
</div>
