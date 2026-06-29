<script lang="ts">
	import { t } from 'svelte-i18n';
	import { Turnstile } from 'svelte-turnstile';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let body = $state('');
	let images: File[] = $state([]);
	let turnstileToken = $state('');
	let submitting = $state(false);
	let success = $state(false);
	let errorMsg = $state('');

	const MAX_CHARS = 1000;
	const MAX_IMAGES = 4;
	const MAX_SIZE = 1024 * 1024;

	async function compressImage(file: File): Promise<Blob> {
		const bitmap = await createImageBitmap(file);
		const maxDim = 1920;
		let { width, height } = bitmap;
		if (width > maxDim || height > maxDim) {
			const ratio = Math.min(maxDim / width, maxDim / height);
			width = Math.round(width * ratio);
			height = Math.round(height * ratio);
		}
		const canvas = new OffscreenCanvas(width, height);
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(bitmap, 0, 0, width, height);

		for (const quality of [0.85, 0.7, 0.5]) {
			const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
			if (blob.size <= MAX_SIZE) return blob;
		}
		return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.5 });
	}

	async function onImagePick(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		if (images.length + files.length > MAX_IMAGES) {
			errorMsg = $t('submit.error.too_many_images');
			return;
		}
		errorMsg = '';
		for (const f of files) {
			if (!f.type.startsWith('image/')) continue;
			images = [...images, f];
		}
	}

	function removeImage(i: number) {
		images = images.filter((_, idx) => idx !== i);
	}

	async function submit() {
		errorMsg = '';
		if (!body.trim()) { errorMsg = $t('submit.error.body_required'); return; }
		if (body.length > MAX_CHARS) { errorMsg = $t('submit.error.too_long'); return; }
		if (!turnstileToken) { errorMsg = $t('submit.error.turnstile'); return; }

		submitting = true;
		try {
			const fd = new FormData();
			fd.append('body', body.trim());
			fd.append('creator_did', data.creator.did);
			fd.append('turnstile_token', turnstileToken);

			for (const img of images) {
				const compressed = await compressImage(img);
				if (compressed.size > MAX_SIZE) { errorMsg = $t('submit.error.image_too_large'); submitting = false; return; }
				fd.append('images', compressed, img.name.replace(/\.\w+$/, '.jpg'));
			}

			const res = await fetch('/api/submit', { method: 'POST', body: fd });
			if (res.status === 429) { errorMsg = $t('submit.error.rate_limit'); return; }
			if (!res.ok) { errorMsg = $t('submit.error.server'); return; }

			success = true;
			body = '';
			images = [];
		} catch {
			errorMsg = $t('submit.error.server');
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>
		{data.creator.displayName ?? data.creator.handle}{$t('submit.title')} - {$t('app.name')}
	</title>
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-10">
	<!-- クリエイターカード -->
	<div class="flex items-center gap-3 mb-6">
		<a href="https://bsky.app/profile/{data.creator.handle}" target="_blank" rel="noopener noreferrer">
			{#if data.creator.avatarUrl}
				<img src={data.creator.avatarUrl} alt="" class="w-12 h-12 rounded-full object-cover" />
			{:else}
				<div class="w-12 h-12 rounded-full bg-primary-900 flex items-center justify-center text-primary-300 font-bold text-lg">
					{(data.creator.displayName ?? data.creator.handle)[0].toUpperCase()}
				</div>
			{/if}
		</a>
		<div>
			<p class="font-semibold text-slate-100">
				{data.creator.displayName ?? data.creator.handle}
			</p>
			<p class="text-sm text-slate-400">@{data.creator.handle}</p>
		</div>
	</div>

	{#if success}
		<div class="bg-green-950 border border-green-800 rounded-2xl p-8 text-center">
			<p class="text-2xl mb-2">✉️</p>
			<p class="font-semibold text-green-200">{$t('submit.success')}</p>
		</div>
	{:else}
		<div class="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-sm">
			{#if errorMsg}
				<p class="mb-4 text-sm text-red-400 bg-red-950 rounded-lg px-3 py-2">{errorMsg}</p>
			{/if}

			<!-- テキスト -->
			<div class="mb-4">
				<label class="block text-sm font-medium text-slate-300 mb-1.5" for="body">
					{$t('submit.body_label')}
				</label>
				<textarea
					id="body"
					bind:value={body}
					placeholder={$t('submit.body_placeholder')}
					rows="5"
					class="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
				></textarea>
				<p class="text-right text-xs text-slate-400 mt-1" class:text-red-500={body.length > MAX_CHARS}>
					{body.length} / {MAX_CHARS}
				</p>
			</div>

			<!-- 画像 -->
			<div class="mb-4">
				<p class="text-sm font-medium text-slate-300 mb-2">{$t('submit.images_label')}</p>
				<div class="flex flex-wrap gap-2 mb-2">
					{#each images as img, i}
						<div class="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-700">
							<img src={URL.createObjectURL(img)} alt="" class="w-full h-full object-cover" />
							<button
								onclick={() => removeImage(i)}
								class="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full text-white text-xs flex items-center justify-center hover:bg-black/80"
								aria-label="Remove image"
							>✕</button>
						</div>
					{/each}
					{#if images.length < MAX_IMAGES}
						<label class="w-20 h-20 rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center cursor-pointer hover:border-primary-400 transition-colors">
							<span class="text-2xl text-slate-600">+</span>
							<input type="file" accept="image/jpeg,image/png,image/webp" multiple onchange={onImagePick} class="hidden" />
						</label>
					{/if}
				</div>
			</div>

			<!-- Turnstile -->
			<div class="mb-4">
				<Turnstile
					siteKey={data.turnstileSiteKey}
					on:callback={(e) => { turnstileToken = e.detail.token; }}
					theme="auto"
				/>
			</div>

			<button
				onclick={submit}
				disabled={submitting || !turnstileToken}
				class="w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
			>
				{submitting ? $t('submit.sending') : $t('submit.button')}
			</button>
		</div>
	{/if}
</div>
