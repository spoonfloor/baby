<!--
	One row of a list you pick from: a menu item, or a line in the sources panel.
	Its content sits at the start and its last child at the end (a mark, a count).
	Defined once here so every list's rows look the same. `muted` is for a row that
	labels the rows under it, e.g. a group heading. `outlined` is for rows that stand
	alone as buttons, each in its own box, e.g. replies to pick while teaching.
	`selected` is the one row picked in a list, held until something else is picked;
	the caller says what that means to assistive tech (e.g. aria-pressed). `below` is
	what a selected row holds under it, inside its highlight, e.g. a picked save’s actions.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		muted?: boolean;
		outlined?: boolean;
		selected?: boolean;
		/** Shown under the row, inside its highlight, while it’s selected. */
		below?: Snippet | undefined;
		children: Snippet;
	}

	let {
		muted = false,
		outlined = false,
		selected = false,
		below,
		type = 'button',
		children,
		...rest
	}: Props = $props();
</script>

{#snippet row(highlighted: boolean)}
	<button {type} class={{ muted, outlined, selected: highlighted }} {...rest}>
		{@render children()}
	</button>
{/snippet}

{#if selected && below}
	<div class="selected">
		{@render row(false)}
		<div class="below">{@render below()}</div>
	</div>
{:else}
	{@render row(selected)}
{/if}

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

	.outlined {
		padding-inline: var(--space-control-inline);
		border: var(--width-outline) solid var(--color-outline);
		border-radius: var(--radius-field);
	}

	/* Bleeds past the text column so the row’s content stays aligned with its neighbors. */
	.selected {
		margin-inline: calc(-1 * var(--space-tight));
		padding-inline: var(--space-tight);
		width: calc(100% + 2 * var(--space-tight));
		border-radius: var(--radius-field);
		background: var(--color-selected);
	}

	.below {
		padding-block-end: var(--space-tight);
	}

	.muted,
	button:disabled {
		color: var(--color-text-muted);
	}

	button:disabled {
		cursor: default;
	}
</style>
