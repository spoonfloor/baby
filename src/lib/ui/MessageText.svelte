<!--
	Message body text. User and Baby messages share it so they always read the same.
	`children` writes the text in pieces of its own instead, e.g. word by word.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { text, children }: { text?: string; children?: Snippet } = $props();
</script>

<p>
	{#if children}{@render children()}{:else}{text}{/if}
</p>

<style>
	p {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
