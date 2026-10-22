<script lang="ts">
	import { t } from 'svelte-i18n';

	const section1Items = [
		'privacy.section1_item_named',
		'privacy.section1_item_qa',
		'privacy.section1_item_app_db',
		'privacy.section1_item_cookie',
		'privacy.section1_item_anonymous'
	];

	const section2Items = [
		'privacy.section2_item1',
		'privacy.section2_item2',
		'privacy.section2_item3'
	];

	const section3Items = [
		'privacy.section3_atproto',
		'privacy.section3_moderation',
		'privacy.section3_turnstile',
		'privacy.section3_dm',
		'privacy.section3_config'
	];
</script>

<svelte:head>
	<title>{$t('privacy.title')} - {$t('app.name')}</title>
</svelte:head>

<article class="site-container py-12">
	<h1 class="text-2xl font-bold text-slate-100">{$t('privacy.title')}</h1>
	<p class="mt-2 text-xs text-slate-400">{$t('privacy.effective_date')}</p>

	<section>
		<h2 class="text-base font-bold text-primary-400 mt-8 mb-2">{$t('privacy.section1_title')}</h2>
		<ul class="list-disc pl-5 space-y-2 text-sm text-slate-300 leading-relaxed">
			{#each section1Items as key}
				<li>{@html $t(key)}</li>
			{/each}
		</ul>
	</section>

	<section>
		<h2 class="text-base font-bold text-primary-400 mt-8 mb-2">{$t('privacy.section2_title')}</h2>
		<ul class="list-disc pl-5 space-y-2 text-sm text-slate-300 leading-relaxed">
			{#each section2Items as key}
				<li>{@html $t(key)}</li>
			{/each}
		</ul>
	</section>

	<section>
		<h2 class="text-base font-bold text-primary-400 mt-8 mb-2">{$t('privacy.section3_title')}</h2>
		<ul class="list-disc pl-5 space-y-2 text-sm text-slate-300 leading-relaxed">
			{#each section3Items as key}
				<li>{@html $t(key)}</li>
			{/each}
		</ul>
	</section>

	<section>
		<h2 class="text-base font-bold text-primary-400 mt-8 mb-2">{$t('privacy.section4_title')}</h2>
		<p class="text-sm text-slate-300 leading-relaxed">{$t('privacy.section4_body')}</p>
	</section>

	<section>
		<h2 class="text-base font-bold text-primary-400 mt-8 mb-2">{$t('privacy.section5_title')}</h2>
		<p class="text-sm text-slate-300 leading-relaxed">{$t('privacy.section5_body')}</p>
	</section>

	<section>
		<h2 class="text-base font-bold text-primary-400 mt-8 mb-2">{$t('privacy.section6_title')}</h2>
		<p class="text-sm text-slate-300 leading-relaxed">{$t('privacy.section6_body')}</p>
	</section>

	<p class="mt-10 text-sm text-slate-400">
		<a href="/terms" class="text-primary-400 underline underline-offset-2 transition-colors hover:text-primary-300">
			{$t('privacy.terms_link')}
		</a>
	</p>
</article>
