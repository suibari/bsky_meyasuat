<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { t } from 'svelte-i18n';
	import { PUBLIC_APP_URL } from '$env/static/public';
	import { createOAuthClient } from '$lib/client/oauthClient.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showAbout = $state(false);
	let handle = $state('');
	let loading = $state(false);
	let error = $state('');

	function openAbout() { showAbout = true; }
	function closeAbout() { showAbout = false; }

	function onDialogClick(e: MouseEvent) {
		if ((e.target as HTMLElement).tagName === 'DIALOG') closeAbout();
	}

	// ローカル開発では OAuth callback と同一オリジン (127.0.0.1) で state を扱う。
	onMount(() => {
		if (window.location.hostname === 'localhost') {
			window.location.replace(
				window.location.href.replace('http://localhost', 'http://127.0.0.1')
			);
			return;
		}

		if (window.location.hash === '#landing-login') {
			window.requestAnimationFrame(() => {
				document.getElementById('landing-login')?.scrollIntoView({ block: 'center' });
			});
		}
	});

	async function signin() {
		if (!browser) return;
		const h = handle.trim().replace(/^@/, '');
		if (!h) return;

		loading = true;
		error = '';
		try {
			const client = await createOAuthClient(data.appUrl);
			await client.signIn(h, data.redirectTo ? { state: data.redirectTo } : undefined);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
			loading = false;
		}
	}

	const features = [
		{ key: 'landing.feature1', descKey: 'landing.feature1_desc', icon: 'inbox', iconClass: 'bg-sky-950 text-sky-300 ring-1 ring-sky-800/70' },
		{ key: 'landing.feature2', descKey: 'landing.feature2_desc', icon: 'user', iconClass: 'bg-emerald-950 text-emerald-300 ring-1 ring-emerald-800/70' },
		{ key: 'landing.feature3', descKey: 'landing.feature3_desc', icon: 'text', iconClass: 'bg-amber-950 text-amber-300 ring-1 ring-amber-800/70' },
		{ key: 'landing.feature4', descKey: 'landing.feature4_desc', icon: 'image', iconClass: 'bg-rose-950 text-rose-300 ring-1 ring-rose-800/70' },
		{ key: 'landing.feature5', descKey: 'landing.feature5_desc', icon: 'bell', iconClass: 'bg-violet-950 text-violet-300 ring-1 ring-violet-800/70' },
		{ key: 'landing.feature6', descKey: 'landing.feature6_desc', icon: 'database', iconClass: 'bg-teal-950 text-teal-300 ring-1 ring-teal-800/70' }
	];

	const heroHighlights = [
		'landing.hero_highlight_long',
		'landing.hero_highlight_images',
		'landing.hero_highlight_notify',
		'landing.hero_highlight_atproto'
	];

	// ヒーロー背景で「メッセージが届いた」雰囲気を演出する浮遊カード。
	// 画像は実際のOGPカード生成コードで書き出したサンプル(scripts/generate-landing-ogp.mjs)。
	// 上中央はタイトルが配置されるため、左右下部のみに配置。
	const floatingCards = [
		{ src: '/landing/ogp-sample-1.png', pos: 'left-[2%] top-[12%] w-36 sm:w-52', rotate: '-6deg', delay: '0s', duration: '15s' },
		{ src: '/landing/ogp-sample-2.png', pos: 'right-[3%] top-[8%] w-32 sm:w-48 hidden sm:block', rotate: '4deg', delay: '3.5s', duration: '17s' },
		{ src: '/landing/ogp-sample-3.png', pos: 'left-[5%] bottom-[6%] w-40 sm:w-56 hidden sm:block', rotate: '3deg', delay: '7s', duration: '19s' },
		{ src: '/landing/ogp-sample-1.png', pos: 'right-[6%] bottom-[10%] w-32 sm:w-44', rotate: '-3deg', delay: '10.5s', duration: '16s' }
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
<section class="relative overflow-hidden bg-linear-to-b from-slate-900 to-slate-950 py-20 px-4 text-center">
	<div class="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
		{#each floatingCards as card}
			<img
				src={card.src}
				alt=""
				class="floating-card absolute rounded-xl border border-slate-700/50 shadow-xl shadow-black/40 {card.pos}"
				style="--card-rotate: {card.rotate}; animation-delay: {card.delay}; animation-duration: {card.duration};"
			/>
		{/each}
	</div>
	<div class="relative z-10">
	<h1 class="mb-8 flex items-center justify-center gap-3 sm:gap-4">
		<img
			src="/icon_meyasuat_white.png"
			alt=""
			aria-hidden="true"
			class="h-12 w-12 shrink-0 sm:h-20 sm:w-20 md:h-28 md:w-28"
		/>
		{#if data.lang === 'ja'}
			<img src="/title.png" alt={$t('app.name')} class="h-12 w-auto sm:h-20 md:h-28" />
		{:else}
			<span class="font-killgothic text-5xl sm:text-6xl md:text-8xl font-bold text-white whitespace-nowrap">{$t('app.name')}</span>
		{/if}
	</h1>
	<p class="text-slate-400 mb-8 max-w-lg mx-auto">
		{$t('landing.hero_sub')}
	</p>
	<ul class="mx-auto mb-8 flex max-w-2xl flex-wrap items-center justify-center gap-2">
		{#each heroHighlights as highlight}
			<li class="rounded-full border border-accent-500/40 bg-accent-500/10 px-3 py-1.5 text-sm font-semibold text-accent-400 shadow-sm shadow-accent-950/20">
				{$t(highlight)}
			</li>
		{/each}
	</ul>
	{#if data.user}
		<a
			href="/dashboard"
			class="inline-block bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-8 py-3 rounded-full transition-colors shadow-sm"
		>
			{$t('nav.dashboard')} →
		</a>
	{:else}
		<div id="landing-login" class="mx-auto w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900/70 p-4 text-left shadow-sm">
			{#if loading}
				<div class="py-4 text-center text-slate-400">
					<div class="mb-2 inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
					<p class="text-sm">{$t('signin.loading')}</p>
				</div>
			{:else}
				{#if error}
					<p class="mb-3 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-400">{error}</p>
				{/if}
				<form
					onsubmit={(e) => {
						e.preventDefault();
						signin();
					}}
				>
					<label class="mb-1.5 block text-sm font-medium text-slate-300" for="landing-handle">
						{$t('signin.handle_label')}
					</label>
					<input
						id="landing-handle"
						type="text"
						bind:value={handle}
						placeholder={$t('signin.handle_placeholder')}
						autocomplete="username"
						class="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
					/>
					<button
						type="submit"
						class="w-full rounded-lg bg-cyan-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-700"
					>
						{$t('landing.cta')}
					</button>
				</form>
			{/if}
		</div>
		<p class="mt-4 text-sm text-slate-400">
			<a
				href="https://bsky.app"
				target="_blank"
				rel="noopener noreferrer"
				class="hover:text-primary-400 underline underline-offset-2 transition-colors"
			>{$t('landing.register_bsky')}</a>
		</p>
	{/if}
	</div>
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
				<div class="text-3xl font-bold text-accent-400 mb-3">{step.num}</div>
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

<!-- 特徴 -->
<section class="max-w-3xl mx-auto px-4 py-16">
	<h2 class="text-xl font-bold text-slate-200 text-center mb-10">
		{$t('landing.features_title')}
	</h2>
	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
		{#each features as feature}
			<div class="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left shadow-sm">
				<span class={`mb-4 grid size-14 place-items-center rounded-xl ${feature.iconClass}`}>
					{#if feature.icon === 'inbox'}
						<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-7">
							<path d="M22 12h-6l-2 3h-4l-2-3H2" />
							<path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
						</svg>
					{:else if feature.icon === 'user'}
						<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-7">
							<path d="M20 21a8 8 0 0 0-16 0" />
							<circle cx="12" cy="7" r="4" />
						</svg>
					{:else if feature.icon === 'text'}
						<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-7">
							<path d="M17 6.1H3" />
							<path d="M21 12.1H3" />
							<path d="M15.1 18H3" />
						</svg>
					{:else if feature.icon === 'image'}
						<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-7">
							<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
							<circle cx="9" cy="9" r="2" />
							<path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
						</svg>
					{:else if feature.icon === 'bell'}
						<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-7">
							<path d="M10.3 21a2 2 0 0 0 3.4 0" />
							<path d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 9h18c0-2-3-2-3-9" />
						</svg>
					{:else}
						<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-7">
							<ellipse cx="12" cy="5" rx="9" ry="3" />
							<path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
							<path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
						</svg>
					{/if}
				</span>
				<h3 class="font-semibold text-slate-200 mb-2">{$t(feature.key)}</h3>
				<p class="text-sm text-slate-400">{$t(feature.descKey)}</p>
			</div>
		{/each}
	</div>
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
			<h3 class="text-sm font-bold text-primary-400">{$t('about.notice_heading')}</h3>
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
				<li>{$t('about.notice_conduct')}</li>
				<li>{$t('about.notice5')}</li>
				<li>{$t('about.disclaimer')}</li>
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
				class="bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium px-5 py-2 rounded-full transition-colors"
			>
				{$t('about.close')}
			</button>
		</div>
	</div>
</dialog>
{/if}

<style>
	.floating-card {
		opacity: 0;
		animation-name: card-float;
		animation-timing-function: ease-in-out;
		animation-iteration-count: infinite;
	}

	@keyframes card-float {
		0% {
			opacity: 0;
			transform: translateY(28px) scale(0.94) rotate(var(--card-rotate, 0deg));
		}
		12% {
			opacity: 0.25;
			transform: translateY(0) scale(1) rotate(var(--card-rotate, 0deg));
		}
		45% {
			opacity: 0.25;
			transform: translateY(-12px) scale(1) rotate(var(--card-rotate, 0deg));
		}
		70%,
		100% {
			opacity: 0;
			transform: translateY(-32px) scale(0.96) rotate(var(--card-rotate, 0deg));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.floating-card {
			animation: none;
			opacity: 0.12;
			transform: rotate(var(--card-rotate, 0deg));
		}
	}
</style>
