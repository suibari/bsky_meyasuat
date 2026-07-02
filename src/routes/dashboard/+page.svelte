<script lang="ts">
	import { t } from 'svelte-i18n';
	import { invalidateAll } from '$app/navigation';
	import { navigating } from '$app/state';
	import QACard from '$lib/components/QACard.svelte';
	import ShareModal from '$lib/components/ShareModal.svelte';
	import { deleteRecordOnPds } from '$lib/client/oauthClient.js';
	import { ogImageUrl, pageShareUrl } from '$lib/utils/share.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let copied = $state(false);
	let deleteTargetId = $state<string | null>(null);
	let deleteTargetType = $state<'message' | 'question' | 'answer'>('message');
	let replyingTo = $state<string | null>(null);
	let replyText = $state<string>('');
	let sharingMessageId = $state<string | null>(null);
	let showBoxShare = $state(false);
	let isSubmittingReply = $state(false);
	let replyError = $state<string | null>(null);
	let deleteError = $state<string | null>(null);

	const MAX_CHARS = 10000;

	const boxUrl = $derived(`${data.appUrl}/u/${data.user?.handle}`);
	const boxName = $derived(data.user?.boxName?.trim() || $t('dashboard.title'));

	async function copyUrl() {
		await navigator.clipboard.writeText(boxUrl);
		copied = true;
		setTimeout(() => { copied = false; }, 2000);
	}

	async function markRead(id: string) {
		await fetch(`/api/messages/${id}/read`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: true }) });
		await invalidateAll();
	}

	async function markUnread(id: string) {
		await fetch(`/api/messages/${id}/read`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: false }) });
		await invalidateAll();
	}

	async function recordAnswerOnPds(msg: any, answer: string): Promise<void> {
		try {
			const [{ createOAuthClient }, { Agent }] = await Promise.all([import('$lib/client/oauthClient.js'), import('@atproto/api')]);
			const client = await createOAuthClient(data.appUrl);
			const session = await client.restore(data.user?.did ?? '');
			const agent = new Agent(session);
			const created = await agent.com.atproto.repo.createRecord({
				repo: data.user?.did ?? '',
				collection: 'com.suibari.meyasuat.answer',
				record: {
					$type: 'com.suibari.meyasuat.answer',
					...(msg.senderDid ? { subject: msg.senderDid } : {}),
					question: msg.body,
					...(msg.questionRecordUri && msg.questionRecordCid
						? { questionRef: { uri: msg.questionRecordUri, cid: msg.questionRecordCid } }
						: {}),
					answer,
					url: `${data.appUrl}/u/${data.user?.handle}/m/${msg.id}`,
					createdAt: new Date().toISOString()
				}
			});

			await fetch(`/api/messages/${msg.id}/answer-ref`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ uri: created.data.uri, cid: created.data.cid })
			});
		} catch (e) {
			console.error('Failed to record answer on PDS', e);
		}
	}

	async function deleteQuestionOnPds(msg: any): Promise<void> {
		if (!data.user || !msg.questionRecordUri) return;
		await deleteRecordOnPds(data.appUrl, data.user.did, msg.questionRecordUri);
	}

	async function deleteAnswerOnPds(msg: any): Promise<void> {
		if (!data.user || !msg.answerRecordUri) return;
		await deleteRecordOnPds(data.appUrl, data.user.did, msg.answerRecordUri);
	}

	async function submitReply(msg: any) {
		replyError = null;
		if (!replyText.trim()) return;
		if (replyText.length > MAX_CHARS) {
			replyError = $t('message.answer_error.too_long');
			return;
		}

		isSubmittingReply = true;
		try {
			const res = await fetch(`/api/messages/${msg.id}/answer`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ answer: replyText.trim() })
			});
			if (!res.ok) {
				replyError = $t('message.answer_error.server');
				return;
			}
			const result = await res.json() as { answer: string };
			
			// 先にPDSへの記録などの回答処理をすべて終わらせる
			await recordAnswerOnPds(msg, result.answer);

			// モーダルを表示し、入力ペインを閉じる
			sharingMessageId = msg.id;
			replyingTo = null;

			// 回答処理がすべて完了してから既読状態へ移動させる
			if (!msg.isRead) {
				await markRead(msg.id);
			} else {
				await invalidateAll();
			}
		} catch (e) {
			replyError = $t('message.answer_error.server');
		} finally {
			isSubmittingReply = false;
		}
	}

	function confirmDelete(id: string, type: 'message' | 'question' | 'answer' = 'message') {
		deleteTargetId = id;
		deleteTargetType = type;
		deleteError = null;
	}

	function cancelDelete() {
		deleteTargetId = null;
		deleteError = null;
	}

	function mapDeleteErrorByStatus(status: number): string {
		if (status === 409) return $t('dashboard.delete_error.pds_conflict');
		if (status === 502) return $t('dashboard.delete_error.pds_verify_failed');
		return $t('dashboard.delete_error');
	}

	async function executeDelete() {
		if (!deleteTargetId) return;
		deleteError = null;
		const target = data.messages.find((m) => m.id === deleteTargetId);
		if (!target) {
			deleteTargetId = null;
			return;
		}

		try {
			if (deleteTargetType === 'question') {
				await deleteQuestionOnPds(target);
				const res = await fetch(`/api/messages/${deleteTargetId}/question`, { method: 'DELETE' });
				if (!res.ok) {
					deleteError = mapDeleteErrorByStatus(res.status);
					return;
				}
			} else if (deleteTargetType === 'answer') {
				await deleteAnswerOnPds(target);
				const res = await fetch(`/api/messages/${deleteTargetId}/answer`, { method: 'DELETE' });
				if (!res.ok) {
					deleteError = mapDeleteErrorByStatus(res.status);
					return;
				}
			} else {
				const res = await fetch(`/api/messages/${deleteTargetId}`, { method: 'DELETE' });
				if (!res.ok) {
					deleteError = mapDeleteErrorByStatus(res.status);
					return;
				}
			}
		} catch (e) {
			deleteError = $t('dashboard.delete_error');
			return;
		}

		deleteTargetId = null;
		await invalidateAll();
	}

	function onDialogClick(e: MouseEvent) {
		if ((e.target as HTMLElement).tagName === 'DIALOG') cancelDelete();
	}
</script>

<svelte:head>
	<title>{$t('dashboard.page_title', { values: { box: boxName } })} - {$t('app.name')}</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-8">
	<!-- URL シェア -->
	<div class="bg-primary-950 border border-primary-800 rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-3">
		<div class="flex-1 min-w-0">
			<p class="text-xs text-primary-400 font-medium mb-0.5">{$t('dashboard.your_url', { values: { box: boxName } })}</p>
			<a
				href={boxUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="block text-sm text-slate-300 truncate font-mono hover:text-primary-300 hover:underline"
			>
				{boxUrl}
			</a>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<button
				onclick={() => showBoxShare = true}
				aria-label={$t('dashboard.share_box')}
				class="shrink-0 p-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
			>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
					<circle cx="18" cy="5" r="3" />
					<circle cx="6" cy="12" r="3" />
					<circle cx="18" cy="19" r="3" />
					<path d="M8.59 13.51l6.83 3.98" />
					<path d="M15.41 6.51l-6.82 3.98" />
				</svg>
			</button>
			<button
				onclick={copyUrl}
				class="shrink-0 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-3 py-1.5 rounded-lg transition-colors"
			>
				{copied ? $t('dashboard.copied') : $t('dashboard.copy')}
			</button>
		</div>
	</div>

	<div class="flex items-center justify-between mb-4">
		<h1 class="text-xl font-bold text-slate-100">{boxName}</h1>
		{#if data.unreadCount > 0}
			<span class="text-xs bg-red-600 text-white px-2.5 py-1 rounded-full font-medium">
				{$t('dashboard.unread', { values: { count: data.unreadCount } })}
			</span>
		{/if}
	</div>

	<!-- タブ -->
	<div class="flex gap-1 mb-5 border-b border-slate-800">
		<a
			href="?tab=unread"
			class="px-4 py-2 text-sm font-medium transition-colors rounded-t-lg {data.tab === 'unread' ? 'text-primary-400 border-b-2 border-primary-400' : 'text-slate-500 hover:text-slate-300'}"
		>
			{$t('dashboard.tab_unread')}
		</a>
		<a
			href="?tab=read"
			class="px-4 py-2 text-sm font-medium transition-colors rounded-t-lg {data.tab === 'read' ? 'text-primary-400 border-b-2 border-primary-400' : 'text-slate-500 hover:text-slate-300'}"
		>
			{$t('dashboard.tab_read')}
		</a>
		<a
			href="?tab=answered"
			class="px-4 py-2 text-sm font-medium transition-colors rounded-t-lg {data.tab === 'answered' ? 'text-primary-400 border-b-2 border-primary-400' : 'text-slate-500 hover:text-slate-300'}"
		>
			{$t('dashboard.tab_answered')}
		</a>
		<a
			href="?tab=sent"
			class="px-4 py-2 text-sm font-medium transition-colors rounded-t-lg {data.tab === 'sent' ? 'text-primary-400 border-b-2 border-primary-400' : 'text-slate-500 hover:text-slate-300'}"
		>
			{$t('dashboard.tab_sent')}
		</a>
	</div>

	<div class="relative">
		{#if navigating.to}
			<div class="absolute inset-0 z-10 flex justify-center rounded-xl bg-slate-950/60 pt-16">
				<div class="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
			</div>
		{/if}
			{#if data.messages.length === 0}
			<div class="text-center py-16 text-slate-600">
				<p class="text-4xl mb-3">📭</p>
				<p class="font-medium">
					{data.tab === 'answered'
						? $t('dashboard.empty_answered')
						: data.tab === 'read'
							? $t('dashboard.empty_read')
							: data.tab === 'sent'
								? $t('dashboard.empty_sent')
								: $t('dashboard.empty_unread')}
				</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each data.messages as msg (msg.id)}
					<QACard
						body={msg.body}
						sender={data.tab === 'sent' ? msg.creator : msg.sender}
						senderHref={data.tab === 'sent'
							? msg.creator
								? `/u/${msg.creator.handle}`
								: undefined
							: msg.sender
								? `/u/${msg.sender.handle}`
								: undefined}
						imageUrls={msg.imageUrls}
						createdAt={msg.createdAt}
						answer={data.tab === 'unread' || data.tab === 'read' ? null : msg.answer}
						answeredAt={data.tab === 'unread' || data.tab === 'read' ? undefined : msg.answeredAt}
						answererLabel={$t('dashboard.your_answer')}
						unread={data.tab === 'unread' && !msg.isRead}
						expandedPaneOpen={(data.tab === 'unread' || data.tab === 'read') && replyingTo === msg.id}
					>
						{#snippet questionActions()}
							{#if data.tab === 'unread' || data.tab === 'read'}
								{#if !msg.isRead}
									<button
										onclick={() => markRead(msg.id)}
										class="text-xs text-slate-400 hover:text-slate-200 transition-colors"
									>
										{$t('dashboard.mark_read')}
									</button>
								{:else}
									<button
										onclick={() => markUnread(msg.id)}
										class="text-xs text-slate-400 hover:text-slate-200 transition-colors"
									>
										{$t('dashboard.mark_unread')}
									</button>
								{/if}
								<button
									onclick={() => { replyingTo = replyingTo === msg.id ? null : msg.id; replyText = ''; replyError = null; }}
									class="text-xs bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1.5 rounded-lg transition-colors"
								>
									{$t('dashboard.answer_button')}
								</button>
								<button
									onclick={() => confirmDelete(msg.id, 'message')}
									class="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors"
								>
									{$t('dashboard.hide_question')}
								</button>
							{:else if data.tab === 'sent'}
								<button
									onclick={() => confirmDelete(msg.id, 'question')}
									class="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors"
								>
									{$t('dashboard.delete_question')}
								</button>
							{/if}
						{/snippet}
						{#snippet expandedPane()}
							{#if replyingTo === msg.id}
								{#if replyError}
									<p class="mb-3 text-sm text-red-400 bg-red-950/50 rounded-lg px-3 py-2 border border-red-900/50">{replyError}</p>
								{/if}
								<textarea
									bind:value={replyText}
									placeholder={$t('dashboard.answer_placeholder')}
									rows="4"
									class="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none mb-2"
								></textarea>
								<div class="flex items-center justify-between">
									<p class="text-xs text-slate-500" class:text-red-500={replyText.length > MAX_CHARS}>
										{replyText.length} / {MAX_CHARS}
									</p>
									<div class="flex gap-2">
										<button
											onclick={() => { replyingTo = null; replyText = ''; replyError = null; }}
											disabled={isSubmittingReply}
											class="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
										>
											{$t('dashboard.delete_cancel')}
										</button>
										<button
											onclick={() => submitReply(msg)}
											disabled={isSubmittingReply || !replyText.trim()}
											class="text-xs bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-medium px-4 py-1.5 rounded-lg transition-colors"
										>
											{isSubmittingReply ? $t('dashboard.answer_sending') : $t('dashboard.submit_answer')}
										</button>
									</div>
								</div>
							{/if}
						{/snippet}
						{#snippet answerActions()}
							{#if data.tab === 'answered'}
								<button
									onclick={() => confirmDelete(msg.id, 'answer')}
									class="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors"
								>
									{$t('dashboard.delete_answer')}
								</button>
							{/if}
						{/snippet}
					</QACard>
				{/each}
			</div>

			<!-- ページネーション -->
			{#if data.messages.length === 20}
				<div class="mt-6 text-center">
					<a href="?tab={data.tab}&page={data.page + 1}" class="text-sm text-primary-400 hover:underline">
						次のページ →
					</a>
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- 削除確認モーダル -->
{#if deleteTargetId}
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<dialog
	open
	onclick={onDialogClick}
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 w-full h-full max-w-none max-h-none p-4 m-0 border-none"
>
	<div class="bg-slate-900 rounded-2xl shadow-xl max-w-sm w-full p-6 relative">
		<h2 class="text-base font-bold text-slate-100 mb-3">
			{deleteTargetType === 'question'
				? $t('dashboard.delete_question_title')
				: deleteTargetType === 'answer'
					? $t('dashboard.delete_answer_title')
					: $t('dashboard.hide_question_title')}
		</h2>
		<p class="text-sm text-slate-400 mb-4">
			{deleteTargetType === 'question'
				? $t('dashboard.delete_question_confirm')
				: deleteTargetType === 'answer'
					? $t('dashboard.delete_answer_confirm')
					: $t('dashboard.hide_question_confirm')}
		</p>
		{#if deleteError}
			<p class="mb-4 text-sm text-red-400 bg-red-950/50 rounded-lg px-3 py-2 border border-red-900/50">{deleteError}</p>
		{/if}
		<div class="flex justify-end gap-2">
			<button
				onclick={cancelDelete}
				class="text-sm text-slate-400 hover:text-slate-200 px-4 py-2 rounded-lg transition-colors"
			>
				{$t('dashboard.delete_cancel')}
			</button>
			<button
				onclick={executeDelete}
				class="text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
			>
				{deleteTargetType === 'question'
					? $t('dashboard.delete_question')
					: deleteTargetType === 'answer'
						? $t('dashboard.delete_answer')
						: $t('dashboard.hide_question')}
			</button>
		</div>
	</div>
</dialog>
{/if}

<!-- シェアモーダル -->
{#if sharingMessageId}
	<ShareModal
		ogImageUrl={ogImageUrl(data.appUrl, sharingMessageId)}
		shareUrl={pageShareUrl(data.appUrl, data.user?.handle ?? '', sharingMessageId)}
		onClose={() => sharingMessageId = null}
	/>
{/if}

{#if showBoxShare}
	<ShareModal
		ogImageUrl={`${data.appUrl}/api/og/u/${data.user?.handle}`}
		shareUrl={boxUrl}
		title={$t('dashboard.share_box_title')}
		onClose={() => showBoxShare = false}
	/>
{/if}
