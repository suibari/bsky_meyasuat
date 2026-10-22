<script lang="ts">
	import { t } from 'svelte-i18n';

	const prohibitedItems = [
		'terms.article3_item1',
		'terms.article3_item2',
		'terms.article3_item3',
		'terms.article3_item4'
	];
</script>

<svelte:head>
	<title>{$t('terms.title')} - {$t('app.name')}</title>
</svelte:head>

<article class="site-container py-12">
	<h1 class="text-2xl font-bold text-slate-100">{$t('terms.title')}</h1>
	<p class="mt-2 text-xs text-slate-400">{$t('terms.effective_date')}</p>

	<section>
		<h2 class="text-base font-bold text-primary-400 mt-8 mb-2">{$t('terms.article1_title')}</h2>
		<p class="text-sm text-slate-300 leading-relaxed">{$t('terms.article1_body')}</p>
	</section>

	<section>
		<h2 class="text-base font-bold text-primary-400 mt-8 mb-2">{$t('terms.article2_title')}</h2>
		<p class="text-sm text-slate-300 leading-relaxed">{$t('terms.article2_body')}</p>
		<ol class="mt-3 list-decimal pl-5 space-y-2 text-sm text-slate-300 leading-relaxed">
			<li>{$t('terms.article2_item1')}</li>
			<li>{@html $t('terms.article2_item2')}</li>
			<li>{$t('terms.article2_item3')}</li>
		</ol>
	</section>

	<section>
		<h2 class="text-base font-bold text-primary-400 mt-8 mb-2">{$t('terms.article3_title')}</h2>
		<p class="text-sm text-slate-300 leading-relaxed">{$t('terms.article3_body')}</p>
		<ul class="mt-3 list-disc pl-5 space-y-1 text-sm text-slate-300 leading-relaxed">
			{#each prohibitedItems as key}
				<li>{$t(key)}</li>
			{/each}
		</ul>
	</section>

	<section>
		<h2 class="text-base font-bold text-primary-400 mt-8 mb-2">{$t('terms.article4_title')}</h2>
		<ol class="list-decimal pl-5 space-y-2 text-sm text-slate-300 leading-relaxed">
			<li>{$t('terms.article4_item1')}</li>
			<li>{$t('terms.article4_item2')}</li>
		</ol>
	</section>

	<section>
		<h2 class="text-base font-bold text-primary-400 mt-8 mb-2">{$t('terms.article5_title')}</h2>
		<p class="text-sm text-slate-300 leading-relaxed">{$t('terms.article5_body')}</p>
	</section>

	<p class="mt-10 text-sm text-slate-400">
		<a href="/privacy" class="text-primary-400 underline underline-offset-2 transition-colors hover:text-primary-300">
			{$t('terms.privacy_link')}
		</a>
	</p>
</article>
