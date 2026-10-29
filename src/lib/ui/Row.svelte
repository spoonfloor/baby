<!--
	One row of a list you pick from: a menu item, or a line in the sources panel.
	Its content sits at the start and its last child at the end (a mark, a count).
	Defined once here so every list's rows look the same. `muted` is for a row that
	labels the rows under it, e.g. a group heading.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		muted?: boolean;
		children: Snippet;
	}

	let { muted = false, type = 'button', children, ...rest }: Props = $props();
</script>

<button {type} class={{ muted }} {...rest}>
	{@render children()}
</button>

<style>
	button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-inline);
		width: 100%;
		padding: var(--space-control-block) 0;
		border: none;
		background: none;
		text-align: start;
		cursor: pointer;
	}

	.muted,
	button:disabled {
		color: var(--color-text-muted);
	}

	button:disabled {
		cursor: default;
	}
</style>
