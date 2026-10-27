<script lang="ts">
	import MessageText from './MessageText.svelte';
	import StatusLine from './StatusLine.svelte';

	let { text, status, pending }: { text: string; status: string; pending: boolean } = $props();
</script>

<div class="baby">
	{#if status}
		<StatusLine text={status} active={pending} />
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
