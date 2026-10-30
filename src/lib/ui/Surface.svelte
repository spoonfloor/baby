<!--
	The raised container for everything that sits "on" the page: the composer, the
	user’s message bubbles, menus, dialogs and the sources panel. Its look is defined once,
	here. Dialogs are `roomy`: equal padding on every side. Menus are `raised`: a step
	lighter, so they read as a layer above the surface they open from.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { provideSurface } from './surface.ts';

	interface Props extends HTMLAttributes<HTMLElement> {
		as?: 'div' | 'form';
		roomy?: boolean;
		raised?: boolean;
		children: Snippet;
	}

	let { as = 'div', roomy = false, raised = false, children, ...rest }: Props = $props();

	let element: HTMLElement;
	provideSurface(() => element);
</script>

<svelte:element this={as} bind:this={element} class={['surface', { roomy, raised }]} {...rest}>
	{@render children()}
</svelte:element>

<style>
	.surface {
		background: var(--color-surface);
		border-radius: var(--radius-surface);
		padding: var(--space-surface-block) var(--space-surface-inline);
	}

	.raised {
		background: var(--color-surface-raised);
	}

	.roomy {
		padding: var(--space-surface-roomy);
	}
</style>
