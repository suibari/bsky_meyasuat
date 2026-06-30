<script lang="ts">
	import { t } from 'svelte-i18n';
	import { invalidateAll } from '$app/navigation';
	import AnsweredQAList from '$lib/components/AnsweredQAList.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const boxName = $derived(data.creator.boxName?.trim() || 'めやすばこ');
	const ogUrl = $derived(`${data.appUrl}/api/og/${data.message.id}`);
	const pageUrl = $derived(`${data.appUrl}/u/${data.creator.handle}/m/${data.message.id}`);
	const ogDescription = $derived(
		(data.message.answer ?? data.message.body).slice(0, 100)
	);

	let answerText = $state('');
	let submitting = $state(false);
	let errorMsg = $state('');
	let savedAnswer = $state<string | null>(null);
	$effect(() => { savedAnswer = data.message.answer; });

	const MAX_CHARS = 1000;

	const blueskyShareUrl = $derived(
		savedAnswer
			? `https://bsky.app/intent/compose?text=${encodeURIComponent(`${savedAnswer}\n${pageUrl}`)}`
			: ''
	);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, {
			year: 'numeric', month: 'long', day: 'numeric'
		});
	}

	async function recordAnswerOnPds(answer: string): Promise<void> {
		try {
			const [{ createOAuthClient }, { Agent }] = await Promise.all([
				import('$lib/client/oauthClient.js'),
				import('@atproto/api')
			]);
			const client = await createOAuthClient(data.appUrl);
			const session = await client.restore(data.creator.did);
			const agent = new Agent(session);
			await agent.com.atproto.repo.createRecord({
				repo: data.creator.did,
				collection: 'com.suibari.meyasuat.answer',
				record: {
					$type: 'com.suibari.meyasuat.answer',
					...(data.message.senderDid ? { subject: data.message.senderDid } : {}),
					question: data.message.body,
					...(data.message.questionRecordUri && data.message.questionRecordCid
						? { questionRef: { uri: data.message.questionRecordUri, cid: data.message.questionRecordCid } }
						: {}),
					answer,
					url: pageUrl,
					createdAt: new Date().toISOString()
				}
			});
		} catch (e) {
			console.error('Failed to record answer on PDS', e);
		}
	}

	async function submitAnswer() {
		errorMsg = '';
		if (!answerText.trim()) { errorMsg = $t('message.answer_error.required'); return; }
		if (answerText.length > MAX_CHARS) { errorMsg = $t('message.answer_error.too_long'); return; }

		submitting = true;
		try {
			const res = await fetch(`/api/messages/${data.message.id}/answer`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ answer: answerText.trim() })
			});
			if (!res.ok) { errorMsg = $t('message.answer_error.server'); return; }
			const result = await res.json() as { answer: string };
			savedAnswer = result.answer;
			
			if (data.isOwner) {
				recordAnswerOnPds(result.answer);
			}
			
			await invalidateAll();
		} catch {
			errorMsg = $t('message.answer_error.server');
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>{data.creator.displayName ?? data.creator.handle} - {$t('app.name')}</title>
	<meta property="og:title" content="{data.creator.displayName ?? data.creator.handle} への{boxName}" />
	<meta property="og:description" content={ogDescription} />
	<meta property="og:image" content={ogUrl} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:type" content="article" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content={ogUrl} />
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-10">
	<!-- 募集者 -->
	<div class="flex items-center gap-3 mb-6">
		{#if data.creator.avatarUrl}
			<img src={data.creator.avatarUrl} alt="" class="w-10 h-10 rounded-full object-cover" />
		{:else}
			<div class="w-10 h-10 rounded-full bg-primary-900 flex items-center justify-center text-primary-300 font-bold">
				{(data.creator.displayName ?? data.creator.handle)[0].toUpperCase()}
			</div>
		{/if}
		<div>
			<p class="font-semibold text-slate-100 text-sm">
				{data.creator.displayName ?? data.creator.handle}
			</p>
			<p class="text-xs text-slate-400">@{data.creator.handle}</p>
		</div>
	</div>

	<!-- 質問本文 -->
	<div class="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-sm mb-4">
		{#if data.message.sender}
			<div class="flex items-center gap-2 mb-4">
				{#if data.message.sender.avatarUrl}
					<img src={data.message.sender.avatarUrl} alt="" class="w-6 h-6 rounded-full object-cover" />
				{:else}
					<div class="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs">
						{(data.message.sender.displayName ?? data.message.sender.handle)[0].toUpperCase()}
					</div>
				{/if}
				<span class="text-xs text-slate-400">
					<span class="font-medium text-slate-300">{data.message.sender.displayName ?? data.message.sender.handle}</span> (@{data.message.sender.handle})
				</span>
			</div>
		{/if}
		<p class="text-slate-200 leading-relaxed whitespace-pre-wrap">{data.message.body}</p>

		{#if data.message.imageUrls.length > 0}
			<div class="mt-4 flex flex-wrap gap-2">
				{#each data.message.imageUrls as url}
					<a href={url} target="_blank" rel="noopener noreferrer">
						<img src={url} alt="" class="rounded-lg max-h-48 max-w-full object-cover border border-slate-700" />
					</a>
				{/each}
			</div>
		{/if}

		<p class="mt-4 text-xs text-slate-600">
			{$t('message.sent_at', { values: { date: formatDate(data.message.createdAt) } })}
		</p>
	</div>

	<!-- 回答 -->
	{#if savedAnswer}
		<div class="bg-primary-950 rounded-2xl border border-primary-800 p-6 shadow-sm mb-4">
			<p class="text-primary-200 leading-relaxed whitespace-pre-wrap">{savedAnswer}</p>
			{#if data.message.answeredAt}
				<p class="mt-4 text-xs text-primary-600">
					{$t('message.answered_at', { values: { date: formatDate(data.message.answeredAt) } })}
				</p>
			{/if}
		</div>

		{#if data.isOwner}
			<a
				href={blueskyShareUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center justify-center gap-2 w-full bg-sky-500 hover:bg-sky-600 text-white font-medium py-3 rounded-xl transition-colors mb-4"
			>
				{$t('message.post_answer_to_bluesky')}
			</a>
		{/if}
	{:else if data.isOwner}
		<div class="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-sm mb-4">
			{#if errorMsg}
				<p class="mb-4 text-sm text-red-400 bg-red-950 rounded-lg px-3 py-2">{errorMsg}</p>
			{/if}
			<label class="block text-sm font-medium text-slate-300 mb-1.5" for="answer">
				{$t('message.answer_label')}
			</label>
			<textarea
				id="answer"
				bind:value={answerText}
				placeholder={$t('message.answer_placeholder')}
				rows="5"
				class="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
			></textarea>
			<p class="text-right text-xs text-slate-400 mt-1" class:text-red-500={answerText.length > MAX_CHARS}>
				{answerText.length} / {MAX_CHARS}
			</p>
			<button
				onclick={submitAnswer}
				disabled={submitting}
				class="w-full mt-3 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
			>
				{submitting ? $t('message.answer_sending') : $t('message.answer_button')}
			</button>
		</div>
	{:else}
		<p class="text-center text-sm text-slate-500 mb-4">{$t('message.no_answer_yet')}</p>
	{/if}

	<AnsweredQAList items={data.relatedQA} handle={data.creator.handle} title={$t('box.answered_qa_title')} />

	<!-- 自分も目安箱を作る -->
	<p class="mt-6 text-center text-xs text-slate-600">
		<a href="/" class="hover:text-primary-500 transition-colors">{$t('app.name')}</a> で自分の目安箱を作る
	</p>
</div>
