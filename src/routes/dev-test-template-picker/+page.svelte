<script lang="ts">
	import QuestionTemplatePicker from '$lib/components/QuestionTemplatePicker.svelte';

	let body = $state('');
</script>

<div style="max-width:600px;margin:2rem auto;font-family:sans-serif;">
	<textarea id="body" bind:value={body} rows="5" style="width:100%;"></textarea>
	<QuestionTemplatePicker bind:value={body} />
</div>
