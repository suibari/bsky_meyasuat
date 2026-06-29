<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let { lang, size = 'md' }: { lang: 'ja' | 'en'; size?: 'sm' | 'md' } = $props();
	let pendingLang = $state<'ja' | 'en' | null>(null);

	async function setLang(l: 'ja' | 'en') {
		pendingLang = l;
		await fetch('/api/prefs/lang', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang: l }) });
		await invalidateAll();
		pendingLang = null;
	}

	const options: ['ja' | 'en', string, string][] = [
		['ja', 'JA', '日本語'],
		['en', 'EN', 'English'],
	];
</script>

<div
	role="radiogroup"
	class="inline-flex items-center rounded-full p-1 gap-0.5 {size === 'sm' ? 'bg-slate-700' : 'bg-slate-800 border border-slate-700'}"
>
	{#each options as [code, abbr, label]}
		{@const selected = (pendingLang ?? lang) === code}
		<button
			role="radio"
			aria-checked={selected}
			onclick={() => setLang(code)}
			class="rounded-full font-semibold transition-colors {size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-4 py-1.5 text-sm'} {selected ? 'bg-slate-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}"
		>
			{size === 'sm' ? abbr : label}
		</button>
	{/each}
</div>
