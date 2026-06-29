<script lang="ts">
	import { t } from 'svelte-i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showAbout = $state(false);

	function openAbout() { showAbout = true; }
	function closeAbout() { showAbout = false; }

	function onDialogClick(e: MouseEvent) {
		if ((e.target as HTMLElement).tagName === 'DIALOG') closeAbout();
	}
</script>

<svelte:head>
	<title>{$t('app.name')} - {$t('app.tagline')}</title>
	<meta name="description" content={$t('app.description')} />
</svelte:head>

<!-- ヒーロー -->
<section class="bg-linear-to-b from-slate-900 to-slate-950 py-20 px-4 text-center">
	<h1 class="font-killgothic text-6xl md:text-8xl font-bold text-white mb-8">
		{$t('app.name')}
	</h1>
	<p class="text-slate-400 mb-8 max-w-lg mx-auto">
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
			<p>めやすあっとはAT protocolのクリエイターのための無料の目安箱サービスです。</p>
			<ul class="space-y-1 pl-1">
				<li>・あなたの目安箱をつくって、みんなに公開しよう</li>
				<li>・目安箱は匿名で投稿可能</li>
				<li>・回答したらSNSでシェアしよう</li>
			</ul>
			<hr class="border-slate-700" />
			<ul class="space-y-1 text-slate-400">
				<li>本アプリはすいばり個人が趣味で開発運営しています。</li>
				<li>本アプリは目安箱データをアプリ側データベースに保存します。</li>
				<li>個人開発のため手厚いサポートはできず、突如サービスを終了する場合があります。</li>
				<li>このページに記載される文章は予告なく変更する場合があります。</li>
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
