<script lang="ts">
	import MessageText from './MessageText.svelte';
	import Surface from './Surface.svelte';

	/** `label` says what the message is, when it’s more than something said. */
	let { text, label }: { text: string; label?: string | undefined } = $props();
</script>

<div class="bubble">
	<Surface>
		{#if label}
			<p class="label">{label}</p>
		{/if}
		<MessageText {text} />
	</Surface>
</div>

<style>
	.bubble {
		width: fit-content;
		max-width: var(--width-bubble);
		margin-inline-start: auto;
	}

	.label {
		margin: 0 0 var(--space-tight);
		color: var(--color-text-muted);
	}
</style>
