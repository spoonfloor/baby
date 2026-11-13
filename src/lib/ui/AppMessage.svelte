<!-- The app speaking for itself, visibly not Baby. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import MessageText from './MessageText.svelte';

	let {
		text,
		actions
	}: {
		text: string;
		/** Things to do next, under the message; not in the app’s voice. */
		actions?: Snippet | undefined;
	} = $props();
</script>

<div class="message">
	<div class="app">
		<MessageText {text} />
	</div>
	{#if actions}
		<div>{@render actions()}</div>
	{/if}
</div>

<style>
	.message {
		display: flex;
		flex-direction: column;
		gap: var(--space-tight);
	}

	.app {
		color: var(--color-app-voice);
		font-style: var(--font-style-app-voice);
	}
</style>
