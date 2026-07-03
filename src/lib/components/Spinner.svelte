<script lang="ts">
	let { class: className = 'h-4 w-4' }: { class?: string } = $props();
</script>

<span class="{className} animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
