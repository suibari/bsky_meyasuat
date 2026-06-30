<script lang="ts">
	let {
		checked = $bindable(false),
		name,
		disabled = false,
		onchange
	}: {
		checked?: boolean;
		name?: string;
		disabled?: boolean;
		onchange?: (e: Event) => void;
	} = $props();
</script>

<label class="relative inline-flex items-center {disabled ? 'opacity-50' : 'cursor-pointer'}">
	<input type="checkbox" {name} bind:checked {disabled} {onchange} class="sr-only peer" />
	<span
		class="w-11 h-6 bg-slate-700 peer-checked:bg-primary-600 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500"
	></span>
	<span
		class="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5"
	></span>
</label>
