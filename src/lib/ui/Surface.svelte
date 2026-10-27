<!--
	The raised container for everything that sits "on" the page: the composer and
	the user's message bubbles. Its look is defined once, here.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLElement> {
		as?: 'div' | 'form';
		children: Snippet;
	}

	let { as = 'div', children, ...rest }: Props = $props();
</script>

<svelte:element this={as} class="surface" {...rest}>
	{@render children()}
</svelte:element>

<style>
	.surface {
		background: var(--color-surface);
		border-radius: var(--radius-surface);
		padding: var(--space-surface-block) var(--space-surface-inline);
	}
</style>
