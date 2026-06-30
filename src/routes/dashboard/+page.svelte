<script lang="ts">
	import { t } from 'svelte-i18n';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let copied = $state(false);
	let deleteTargetId = $state<string | null>(null);
	let replyingTo = $state<string | null>(null);
	let replyText = $state<string>('');
	let sharingMessageId = $state<string | null>(null);
	let isSubmittingReply = $state(false);
	let replyError = $state<string | null>(null);

	const MAX_CHARS = 1000;

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
			const [{ createOAuthClient }, { Agent }] = await Promise.all([
				import('$lib/client/oauthClient.js'),
				import('@atproto/api')
			]);
			const client = await createOAuthClient(data.appUrl);
			const session = await client.restore(data.user?.did ?? '');
			const agent = new Agent(session);
			await agent.com.atproto.repo.createRecord({
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
		} catch (e) {
			console.error('Failed to record answer on PDS', e);
		}
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

	function confirmDelete(id: string) {
		deleteTargetId = id;
	}

	function cancelDelete() {
		deleteTargetId = null;
	}

	async function executeDelete() {
		if (!deleteTargetId) return;
		await fetch(`/api/messages/${deleteTargetId}`, { method: 'DELETE' });
		deleteTargetId = null;
		await invalidateAll();
	}

	function onDialogClick(e: MouseEvent) {
		if ((e.target as HTMLElement).tagName === 'DIALOG') cancelDelete();
	}

	function replyUrl(handle: string, messageId: string): string {
		const text = `${data.appUrl}/u/${handle}/m/${messageId}`;
		return `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
	}

	function xReplyUrl(handle: string, messageId: string): string {
		return `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${data.appUrl}/u/${handle}/m/${messageId}`)}`;
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleString(undefined, {
			year: 'numeric', month: 'short', day: 'numeric',
			hour: '2-digit', minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>{boxName} - {$t('app.name')}</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-8">
	<!-- URL シェア -->
	<div class="bg-primary-950 border border-primary-800 rounded-2xl p-4 mb-6 flex items-center gap-3">
		<div class="flex-1 min-w-0">
			<p class="text-xs text-primary-400 font-medium mb-0.5">{$t('dashboard.your_url', { values: { box: boxName } })}</p>
			<p class="text-sm text-slate-300 truncate font-mono">{boxUrl}</p>
		</div>
		<button
			onclick={copyUrl}
			class="shrink-0 text-sm bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg transition-colors"
		>
			{copied ? $t('dashboard.copied') : $t('dashboard.copy')}
		</button>
	</div>

	<div class="flex items-center justify-between mb-4">
		<h1 class="text-xl font-bold text-slate-100">{boxName}</h1>
		{#if data.unreadCount > 0}
			<span class="text-xs bg-accent-500 text-white px-2.5 py-1 rounded-full font-medium">
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
	</div>

	{#if data.messages.length === 0}
		<div class="text-center py-16 text-slate-600">
			<p class="text-4xl mb-3">📭</p>
			<p class="font-medium">{data.tab === 'read' ? $t('dashboard.empty_read') : $t('dashboard.empty_unread')}</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each data.messages as msg (msg.id)}
				<div class="relative bg-slate-900 rounded-2xl border {msg.isRead ? 'border-slate-800' : 'border-primary-700'} p-5 shadow-sm">
					<!-- 削除ボタン -->
					<button
						onclick={() => confirmDelete(msg.id)}
						class="absolute top-3 right-3 w-5 h-5 flex items-center justify-center text-slate-600 hover:text-slate-300 transition-colors rounded text-lg leading-none"
						aria-label={$t('dashboard.delete')}
					>
						×
					</button>

					<div class="flex items-start gap-3 mb-3 pr-6">
						{#if !msg.isRead}
							<span class="shrink-0 w-2 h-2 rounded-full bg-primary-500 mt-1.5"></span>
						{/if}
						<div class="flex-1 min-w-0">
							{#if msg.senderHandle}
								<span class="inline-block text-xs font-medium text-slate-300 bg-slate-800 px-2 py-0.5 rounded mb-1.5">@{msg.senderHandle}</span>
							{/if}
							<p class="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>
						</div>
					</div>

					{#if msg.imageUrls.length > 0}
						<div class="flex gap-2 mb-3 flex-wrap">
							{#each msg.imageUrls as url}
								<a href={url} target="_blank" rel="noopener noreferrer">
									<img src={url} alt="" class="w-24 h-24 object-cover rounded-lg border border-slate-700" />
								</a>
							{/each}
						</div>
					{/if}

					<div class="flex flex-wrap items-center justify-between gap-y-2">
						<p class="text-xs text-slate-600">{formatDate(msg.createdAt)}</p>
						<div class="flex flex-wrap items-center gap-2">
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
								class="text-xs bg-sky-500 hover:bg-sky-600 text-white px-3 py-1.5 rounded-lg transition-colors"
							>
								{$t('dashboard.answer_button')}
							</button>
						</div>
					</div>

					{#if replyingTo === msg.id}
						<div class="mt-4 pt-4 border-t border-slate-800">
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
										class="text-xs bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-medium px-4 py-1.5 rounded-lg transition-colors"
									>
										{isSubmittingReply ? $t('dashboard.answer_sending') : $t('dashboard.submit_answer')}
									</button>
								</div>
							</div>
						</div>
					{/if}
				</div>
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

<!-- 削除確認モーダル -->
{#if deleteTargetId}
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<dialog
	open
	onclick={onDialogClick}
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 w-full h-full max-w-none max-h-none p-4 m-0 border-none"
>
	<div class="bg-slate-900 rounded-2xl shadow-xl max-w-sm w-full p-6 relative">
		<h2 class="text-base font-bold text-slate-100 mb-3">{$t('dashboard.delete_title')}</h2>
		<p class="text-sm text-slate-400 mb-6">{$t('dashboard.delete_confirm')}</p>
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
				{$t('dashboard.delete')}
			</button>
		</div>
	</div>
</dialog>
{/if}

<!-- シェアモーダル -->
{#if sharingMessageId}
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<dialog
	open
	onclick={(e) => { if ((e.target as HTMLElement).tagName === 'DIALOG') sharingMessageId = null; }}
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 w-full h-full max-w-none max-h-none p-4 m-0 border-none"
>
	<div class="bg-slate-900 rounded-2xl shadow-xl max-w-sm w-full p-6 relative">
		<h2 class="text-base font-bold text-slate-100 mb-4 text-center">{$t('dashboard.share_title')}</h2>
		
		<img 
			src={`/api/og/u/${data.user?.handle}/m/${sharingMessageId}`} 
			alt="OGP" 
			class="w-full h-auto rounded-xl border border-slate-700 mb-6" 
		/>

		<div class="flex flex-col gap-3 mb-2">
			<a
				href={replyUrl(data.user?.handle ?? '', sharingMessageId)}
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center justify-center gap-2 w-full bg-sky-500 hover:bg-sky-600 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
			>
				{$t('dashboard.share_on_bluesky')}
			</a>
			<a
				href={xReplyUrl(data.user?.handle ?? '', sharingMessageId)}
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center justify-center gap-2 w-full bg-black hover:bg-gray-800 border border-slate-700 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
			>
				{$t('dashboard.share_on_x')}
			</a>
		</div>
		
		<div class="mt-4 text-center">
			<button
				onclick={() => sharingMessageId = null}
				class="text-sm text-slate-400 hover:text-slate-200 px-4 py-2 transition-colors"
			>
				{$t('dashboard.close')}
			</button>
		</div>
	</div>
</dialog>
{/if}
