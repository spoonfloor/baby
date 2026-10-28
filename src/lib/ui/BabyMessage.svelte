<script lang="ts">
	import MessageText from './MessageText.svelte';
	import ProgressBar from './ProgressBar.svelte';
	import StatusLine from './StatusLine.svelte';

	let {
		text,
		status,
		pending,
		progress
	}: {
		text: string;
		status: string;
		pending: boolean;
		/** How far through its work Baby is, when it knows; shown only while pending. */
		progress?: { done: number; total: number } | undefined;
	} = $props();
</script>

<div class="baby">
	{#if status}
		<StatusLine text={status} active={pending} />
	{/if}
	{#if progress && pending}
		<ProgressBar done={progress.done} total={progress.total} />
	{/if}
	<!-- The reply streams in behind the scenes but is shown all at once, when finished. -->
	{#if text && !pending}
		<MessageText {text} />
	{/if}
</div>

<style>
	.baby {
		display: flex;
		flex-direction: column;
		gap: var(--space-tight);
	}
</style>
