<!-- What Baby is doing (or did). Will grow into Baby's visible thought process. -->
<script lang="ts">
	import Spinner from './Spinner.svelte';

	let { text, active }: { text: string; active: boolean } = $props();
</script>

<p aria-live="polite">
	<Spinner spinning={active} />
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
