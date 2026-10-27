<!--
	What Baby is doing (with a spinner, while active) or did (text alone, once finished).
	Will grow into Baby's visible thought process.
-->
<script lang="ts">
	import Spinner from './Spinner.svelte';

	let { text, active }: { text: string; active: boolean } = $props();
</script>

<p aria-live="polite">
	{#if active}
		<Spinner />
	{/if}
	<span>{text}</span>
</p>

<style>
	p {
		display: flex;
		gap: var(--space-inline);
		margin: 0;
		color: var(--color-text-muted);
	}
</style>
