<!-- The app speaking for itself (the Coach), visibly not Baby. -->
<script lang="ts">
	import MessageText from './MessageText.svelte';

	let { text }: { text: string } = $props();
</script>

<div class="app">
	<MessageText {text} />
</div>

<style>
	.app {
		color: var(--color-coach);
		font-style: italic;
	}
</style>
