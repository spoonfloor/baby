<!--
	The raised container for everything that sits "on" the page: the composer, the
	user's message bubbles, menus and dialogs. Its look is defined once, here.
	Dialogs are `roomy`: equal padding on every side, matching the corner radius.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLElement> {
		as?: 'div' | 'form';
		roomy?: boolean;
		children: Snippet;
	}

	let { as = 'div', roomy = false, children, ...rest }: Props = $props();
</script>

<svelte:element this={as} class={['surface', { roomy }]} {...rest}>
	{@render children()}
</svelte:element>

<style>
	.surface {
		background: var(--color-surface);
		border-radius: var(--radius-surface);
		padding: var(--space-surface-block) var(--space-surface-inline);
	}

	.roomy {
		padding: var(--space-surface-roomy);
	}
</style>
