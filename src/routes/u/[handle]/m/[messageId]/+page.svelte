<script lang="ts">
	import { t } from 'svelte-i18n';
	import { invalidateAll } from '$app/navigation';
	import AnsweredQAList from '$lib/components/AnsweredQAList.svelte';
	import QACard from '$lib/components/QACard.svelte';
	import ShareModal from '$lib/components/ShareModal.svelte';
	import { deleteRecordOnPds } from '$lib/client/oauthClient.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const boxName = $derived(data.creator.boxName?.trim() || 'めやすばこ');
	const ogUrl = $derived(`${data.appUrl}/api/og/${data.message.id}`);
	const pageUrl = $derived(`${data.appUrl}/u/${data.creator.handle}/m/${data.message.id}`);
	const ogDescription = $derived(
		(data.message.answer ?? data.message.body).slice(0, 100)
	);
	const questionTitleText = $derived(
		data.message.body.length > 30 ? data.message.body.slice(0, 30) + '…' : data.message.body
	);
	const titleText = $derived(
		`${questionTitleText} - ${data.creator.displayName ?? data.creator.handle}${$t('submit.title', { values: { box: boxName } })}`
	);

	let answerText = $state('');
	let submitting = $state(false);
	let errorMsg = $state('');
	let savedAnswer = $state<string | null>(null);
	let showShareModal = $state(false);
	let deletingAnswer = $state(false);
	$effect(() => { savedAnswer = data.message.answer; });

	const MAX_CHARS = 1000;

	function avatarHref(person: { did: string; handle: string }): string {
		return data.user?.did === person.did ? '/dashboard' : `/u/${person.handle}`;
	}

	function mapDeleteErrorByStatus(status: number): string {
		if (status === 409) return $t('dashboard.delete_error.pds_conflict');
		if (status === 502) return $t('dashboard.delete_error.pds_verify_failed');
		return $t('dashboard.delete_error');
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
			const created = await agent.com.atproto.repo.createRecord({
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

			await fetch(`/api/messages/${data.message.id}/answer-ref`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ uri: created.data.uri, cid: created.data.cid })
			});
		} catch (e) {
			console.error('Failed to record answer on PDS', e);
		}
	}

	async function deleteAnswer() {
		if (!data.isOwner) return;
		deletingAnswer = true;
		errorMsg = '';

		try {
			if (data.message.answerRecordUri) {
				await deleteRecordOnPds(data.appUrl, data.creator.did, data.message.answerRecordUri);
			}

			const res = await fetch(`/api/messages/${data.message.id}/answer`, { method: 'DELETE' });
			if (!res.ok) {
				errorMsg = mapDeleteErrorByStatus(res.status);
				return;
			}

			savedAnswer = null;
			await invalidateAll();
		} catch {
			errorMsg = $t('dashboard.delete_error');
		} finally {
			deletingAnswer = false;
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
				await recordAnswerOnPds(result.answer);
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
	<title>{titleText} - {$t('app.name')}</title>
	<meta property="og:title" content={titleText} />
	<meta property="og:description" content={ogDescription} />
	<meta property="og:image" content={ogUrl} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:type" content="article" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content={ogUrl} />
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-10">
	<!-- 質問+回答 -->
	<div class="mb-4">
		<QACard
			body={data.message.body}
			sender={data.message.sender}
			senderHref={data.message.sender ? avatarHref(data.message.sender) : undefined}
			imageUrls={data.message.imageUrls}
			createdAt={data.message.createdAt}
			answer={savedAnswer}
			answeredAt={data.message.answeredAt}
			creator={savedAnswer ? data.creator : null}
			creatorHref={avatarHref(data.creator)}
		/>
	</div>

	{#if savedAnswer}
		{#if data.isOwner}
			<div class="flex gap-2 mb-4">
				<button
					onclick={() => showShareModal = true}
					class="flex-1 flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-medium py-3 rounded-xl transition-colors"
				>
					{$t('message.share_button')}
				</button>
				<button
					onclick={deleteAnswer}
					disabled={deletingAnswer}
					class="shrink-0 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium px-4 py-3 rounded-xl transition-colors text-sm"
				>
					{$t('dashboard.delete_answer')}
				</button>
			</div>
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

	<AnsweredQAList
		items={data.relatedQA}
		handle={data.creator.handle}
		title={$t('box.answered_qa_title')}
		creator={data.creator}
		creatorHref={avatarHref(data.creator)}
	/>

	<!-- 自分も目安箱を作る -->
	<p class="mt-6 text-center text-xs text-slate-600">
		<a href="/" class="hover:text-primary-500 transition-colors">{$t('app.name')}</a> で自分の目安箱を作る
	</p>
</div>

{#if showShareModal}
	<ShareModal
		ogImageUrl={ogUrl}
		shareUrl={pageUrl}
		onClose={() => showShareModal = false}
	/>
{/if}
