<script lang="ts">
	import MessageText from './MessageText.svelte';
	import StatusLine from './StatusLine.svelte';

	let { text, status, pending }: { text: string; status: string; pending: boolean } = $props();
</script>

<div class="baby">
	{#if status}
		<StatusLine text={status} active={pending} />
	{/if}
	{#if text}
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
