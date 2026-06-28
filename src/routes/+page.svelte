<script lang="ts">
	import { t } from 'svelte-i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{$t('app.name')} - {$t('app.tagline')}</title>
	<meta name="description" content={$t('app.description')} />
</svelte:head>

<!-- ヒーロー -->
<section class="bg-linear-to-b from-primary-50 to-white dark:from-slate-900 dark:to-slate-950 py-20 px-4 text-center">
	<h1 class="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4 leading-tight">
		{$t('landing.hero_title')}
	</h1>
	<p class="text-slate-500 dark:text-slate-400 mb-8 max-w-lg mx-auto">
		{$t('landing.hero_sub')}
	</p>
	{#if data.user}
		<a
			href="/dashboard"
			class="inline-block bg-primary-600 hover:bg-primary-700 text-white font-semibold px-8 py-3 rounded-full transition-colors shadow-sm"
		>
			{$t('nav.dashboard')} →
		</a>
	{:else}
		<a
			href="/signin"
			class="inline-block bg-primary-600 hover:bg-primary-700 text-white font-semibold px-8 py-3 rounded-full transition-colors shadow-sm"
		>
			{$t('landing.cta')}
		</a>
	{/if}
</section>

<!-- 使い方 -->
<section class="max-w-3xl mx-auto px-4 py-16">
	<h2 class="text-xl font-bold text-slate-800 dark:text-slate-200 text-center mb-10">
		{$t('landing.how_title')}
	</h2>
	<div class="grid md:grid-cols-3 gap-6">
		{#each [
			{ num: '01', title: $t('landing.how1_title'), desc: $t('landing.how1_desc') },
			{ num: '02', title: $t('landing.how2_title'), desc: $t('landing.how2_desc') },
			{ num: '03', title: $t('landing.how3_title'), desc: $t('landing.how3_desc') }
		] as step}
			<div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-center shadow-sm">
				<div class="text-3xl font-bold text-primary-200 dark:text-primary-400 mb-3">{step.num}</div>
				<h3 class="font-semibold text-slate-800 dark:text-slate-200 mb-2">{step.title}</h3>
				<p class="text-sm text-slate-500 dark:text-slate-400">{step.desc}</p>
			</div>
		{/each}
	</div>
</section>
