<script lang="ts">
	import { t } from 'svelte-i18n';
	import { PUBLIC_APP_URL } from '$env/static/public';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showAbout = $state(false);

	function openAbout() { showAbout = true; }
	function closeAbout() { showAbout = false; }

	function onDialogClick(e: MouseEvent) {
		if ((e.target as HTMLElement).tagName === 'DIALOG') closeAbout();
	}

	const features = [
		{ key: 'landing.feature1', icon: 'inbox' },
		{ key: 'landing.feature2', icon: 'user' },
		{ key: 'landing.feature3', icon: 'text' },
		{ key: 'landing.feature4', icon: 'image' },
		{ key: 'landing.feature5', icon: 'bell' },
		{ key: 'landing.feature6', icon: 'database' }
	];
</script>

<svelte:head>
	<title>{$t('app.name')} - {$t('app.tagline')}</title>
	<meta name="description" content={$t('app.description')} />
	<meta property="og:image" content="{PUBLIC_APP_URL}/ogp.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content="{PUBLIC_APP_URL}/ogp.png" />
</svelte:head>

<!-- ヒーロー -->
<section class="bg-linear-to-b from-slate-900 to-slate-950 py-20 px-4 text-center">
	<h1 class="mb-8">
		{#if data.lang === 'ja'}
			<img src="/title.png" alt={$t('app.name')} class="w-full sm:w-auto sm:h-20 md:h-28 mx-auto" />
		{:else}
			<span class="font-killgothic text-5xl sm:text-6xl md:text-8xl font-bold text-white whitespace-nowrap">{$t('app.name')}</span>
		{/if}
	</h1>
	<p class="text-slate-400 mb-8 max-w-lg mx-auto">
		{$t('landing.hero_sub')}
	</p>
	<div class="mx-auto mb-3 grid max-w-3xl grid-cols-2 gap-2 text-left text-xs text-slate-200 md:grid-cols-3">
		{#each features as feature}
			<span class="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 shadow-sm">
				<span class="grid size-7 shrink-0 place-items-center rounded-md bg-primary-950 text-primary-300">
					{#if feature.icon === 'inbox'}
						<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
							<path d="M22 12h-6l-2 3h-4l-2-3H2" />
							<path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
						</svg>
					{:else if feature.icon === 'user'}
						<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
							<path d="M20 21a8 8 0 0 0-16 0" />
							<circle cx="12" cy="7" r="4" />
						</svg>
					{:else if feature.icon === 'text'}
						<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
							<path d="M17 6.1H3" />
							<path d="M21 12.1H3" />
							<path d="M15.1 18H3" />
						</svg>
					{:else if feature.icon === 'image'}
						<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
							<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
							<circle cx="9" cy="9" r="2" />
							<path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
						</svg>
					{:else if feature.icon === 'bell'}
						<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
							<path d="M10.3 21a2 2 0 0 0 3.4 0" />
							<path d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 9h18c0-2-3-2-3-9" />
						</svg>
					{:else}
						<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
							<ellipse cx="12" cy="5" rx="9" ry="3" />
							<path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
							<path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
						</svg>
					{/if}
				</span>
				<span class="leading-snug">{$t(feature.key)}</span>
			</span>
		{/each}
	</div>
	<p class="mb-8 text-xs text-slate-500">
		{$t('landing.feature_note')}
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
		<p class="mt-4 text-sm text-slate-400">
			<a
				href="https://bsky.app"
				target="_blank"
				rel="noopener noreferrer"
				class="hover:text-primary-400 underline underline-offset-2 transition-colors"
			>{$t('landing.register_bsky')}</a>
		</p>
	{/if}
</section>

<!-- 使い方 -->
<section class="max-w-3xl mx-auto px-4 py-16">
	<h2 class="text-xl font-bold text-slate-200 text-center mb-10">
		{$t('landing.how_title')}
	</h2>
	<div class="grid md:grid-cols-3 gap-6">
		{#each [
			{ num: '01', title: $t('landing.how1_title'), desc: $t('landing.how1_desc') },
			{ num: '02', title: $t('landing.how2_title'), desc: $t('landing.how2_desc') },
			{ num: '03', title: $t('landing.how3_title'), desc: $t('landing.how3_desc') }
		] as step}
			<div class="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-center shadow-sm">
				<div class="text-3xl font-bold text-primary-400 mb-3">{step.num}</div>
				<h3 class="font-semibold text-slate-200 mb-2">{step.title}</h3>
				<p class="text-sm text-slate-400">{step.desc}</p>
			</div>
		{/each}
	</div>
	<p class="text-center mt-10">
		<button
			onclick={openAbout}
			class="text-xs text-slate-400 hover:text-primary-400 underline underline-offset-2 transition-colors"
		>
			{$t('about.link')}
		</button>
	</p>
</section>

<!-- About モーダル -->
{#if showAbout}
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<dialog
	open
	onclick={onDialogClick}
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 w-full h-full max-w-none max-h-none p-4 m-0 border-none"
>
	<div class="bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6 relative">
		<h2 class="font-killgothic text-xl font-bold text-primary-400 mb-4">
			{$t('about.title')}
		</h2>
		<div class="text-sm text-slate-300 space-y-3">
			<p>{$t('about.lead')}</p>
			<ul class="space-y-1 pl-1">
				<li>・{$t('about.feature1')}</li>
				<li>・{$t('about.feature2')}</li>
				<li>・{$t('about.feature3')}</li>
				<li>・{$t('about.feature4')}</li>
			</ul>
			<hr class="border-slate-700" />
			<ul class="space-y-1 text-slate-400">
				<li>
					{$t('about.notice1_prefix')}<a
						href="https://bsky.app/profile/suibari.com"
						target="_blank"
						rel="noopener noreferrer"
						class="text-primary-400 underline underline-offset-2 transition-colors hover:text-primary-300"
					>{$t('about.notice1_name')}</a>{$t('about.notice1_suffix')}
				</li>
				<li>{$t('about.notice2')}</li>
				<li>{$t('about.notice3')}</li>
				<li>{$t('about.notice4')}</li>
				<li>
					<a
						href="https://github.com/suibari/bsky_meyasuat"
						target="_blank"
						rel="noopener noreferrer"
						class="text-primary-400 underline underline-offset-2 transition-colors hover:text-primary-300"
					>{$t('about.github')}</a>
				</li>
			</ul>
		</div>
		<div class="mt-6 flex justify-end">
			<button
				onclick={closeAbout}
				class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-5 py-2 rounded-full transition-colors"
			>
				{$t('about.close')}
			</button>
		</div>
	</div>
</dialog>
{/if}
