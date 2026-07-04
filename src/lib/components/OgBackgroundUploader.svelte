<script lang="ts">
	import { t } from 'svelte-i18n';
	import Cropper from 'svelte-easy-crop';
	import type { CropArea } from 'svelte-easy-crop/dist/types.js';

	let {
		previewUrl,
		onChange,
		onRemove
	}: {
		previewUrl: string | null;
		onChange: (blob: Blob) => void;
		onRemove: () => void;
	} = $props();

	const OUTPUT_WIDTH = 1200;
	const OUTPUT_HEIGHT = 630;
	const MAX_SIZE = 1024 * 1024;

	let fileInput: HTMLInputElement;
	let imageSrc = $state<string | null>(null);
	let crop = $state({ x: 0, y: 0 });
	let zoom = $state(1);
	let croppedAreaPixels = $state<CropArea | null>(null);
	let processing = $state(false);

	function onPick(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			imageSrc = reader.result as string;
			crop = { x: 0, y: 0 };
			zoom = 1;
			croppedAreaPixels = null;
		};
		reader.readAsDataURL(file);
	}

	function onCropComplete(e: { pixels: CropArea }) {
		croppedAreaPixels = e.pixels;
	}

	async function confirmCrop() {
		if (!imageSrc || !croppedAreaPixels) return;
		processing = true;
		try {
			const bitmap = await createImageBitmap(await (await fetch(imageSrc)).blob());
			const canvas = new OffscreenCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT);
			const ctx = canvas.getContext('2d')!;
			ctx.drawImage(
				bitmap,
				croppedAreaPixels.x,
				croppedAreaPixels.y,
				croppedAreaPixels.width,
				croppedAreaPixels.height,
				0,
				0,
				OUTPUT_WIDTH,
				OUTPUT_HEIGHT
			);

			let blob: Blob | null = null;
			for (const quality of [0.85, 0.7, 0.5]) {
				blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
				if (blob.size <= MAX_SIZE) break;
			}
			if (!blob) return;
			onChange(blob);
			imageSrc = null;
		} finally {
			processing = false;
		}
	}

	function cancelCrop() {
		imageSrc = null;
	}
</script>

<div class="space-y-3">
	{#if imageSrc}
		<div class="relative w-full aspect-1200/630 bg-slate-950 rounded-lg overflow-hidden">
			<Cropper image={imageSrc} bind:crop bind:zoom aspect={OUTPUT_WIDTH / OUTPUT_HEIGHT} oncropcomplete={onCropComplete} />
		</div>
		<input type="range" min="1" max="3" step="0.1" bind:value={zoom} class="w-full" />
		<div class="flex gap-2">
			<button
				type="button"
				onclick={confirmCrop}
				disabled={processing}
				class="text-sm bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg transition-colors"
			>
				{$t('settings.ogp_background_crop_confirm')}
			</button>
			<button
				type="button"
				onclick={cancelCrop}
				disabled={processing}
				class="text-sm text-slate-400 hover:text-slate-200 px-4 py-2 rounded-lg transition-colors"
			>
				{$t('settings.ogp_background_crop_cancel')}
			</button>
		</div>
	{:else}
		{#if previewUrl}
			<img src={previewUrl} alt="" class="w-full aspect-1200/630 object-cover rounded-lg border border-slate-800" />
		{/if}
		<div class="flex gap-2">
			<button
				type="button"
				onclick={() => fileInput.click()}
				class="text-sm bg-slate-800 hover:bg-slate-700 text-slate-100 px-4 py-2 rounded-lg transition-colors border border-slate-700"
			>
				{$t('settings.ogp_background_choose')}
			</button>
			{#if previewUrl}
				<button
					type="button"
					onclick={onRemove}
					class="text-sm text-red-400 hover:text-red-300 px-4 py-2 rounded-lg transition-colors"
				>
					{$t('settings.ogp_background_remove')}
				</button>
			{/if}
		</div>
		<input bind:this={fileInput} type="file" accept="image/jpeg,image/png,image/webp" class="hidden" onchange={onPick} />
	{/if}
</div>
