<script lang="ts">
	import type { Snippet } from 'svelte';
	import MessageText from './MessageText.svelte';
	import ProgressBar from './ProgressBar.svelte';
	import StatusLine from './StatusLine.svelte';

	let {
		text,
		status,
		pending,
		progress,
		actions
	}: {
		text: string;
		status: string;
		pending: boolean;
		/** How far through its work Baby is, when it knows; shown only while pending. */
		progress?: { done: number; total: number } | undefined;
		/** Things to do with a finished message, under it. */
		actions?: Snippet | undefined;
	} = $props();
</script>

<div class="baby">
	{#if status}
		<!-- A progress bar shows activity itself, so the status line drops its spinner. -->
		<StatusLine text={status} active={pending && !progress} />
	{/if}
	{#if progress && pending}
		<ProgressBar done={progress.done} total={progress.total} />
	{/if}
	<!-- The reply streams in behind the scenes but is shown all at once, when finished. -->
	{#if text && !pending}
		<MessageText {text} />
	{/if}
	{#if actions && !pending}
		<div>{@render actions()}</div>
	{/if}
</div>

<style>
	.baby {
		display: flex;
		flex-direction: column;
		gap: var(--space-tight);
	}
</style>
