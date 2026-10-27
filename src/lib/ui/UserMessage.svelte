<script lang="ts">
	import MessageText from './MessageText.svelte';
	import Surface from './Surface.svelte';

	let { text }: { text: string } = $props();
</script>

<div class="bubble">
	<Surface>
		<MessageText {text} />
	</Surface>
</div>

<style>
	.bubble {
		width: fit-content;
		max-width: var(--width-bubble);
		margin-inline-start: auto;
	}
</style>
