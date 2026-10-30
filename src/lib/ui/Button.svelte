<!--
	A text button, optionally led by an icon. `primary` is the one action a view is asking for;
	the rest are plain. `inline` sits in a column of text, aligned with it: no padding.
-->
<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';
	import type { IconName } from './icons.ts';

	interface Props extends HTMLButtonAttributes {
		primary?: boolean;
		inline?: boolean;
		icon?: IconName | undefined;
	}

	let {
		primary = false,
		inline = false,
		icon,
		type = 'button',
		children,
		...rest
	}: Props = $props();
</script>

<button {type} class={{ primary, inline }} {...rest}>
	{#if icon}
		<Icon name={icon} small />
	{/if}
	{@render children?.()}
</button>

<style>
	button {
		display: inline-flex;
		gap: var(--space-inline);
		align-items: center;
		padding: var(--space-control-block) var(--space-control-inline);
		border: none;
		border-radius: var(--radius-pill);
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	/*
	 * An action under a message: a muted label, so it reads as a control rather than
	 * more of the message's words.
	 */
	.inline {
		padding: 0;
		font-size: var(--font-size-label);
	}

	.inline:hover {
		color: var(--color-text);
	}

	.primary {
		background: var(--color-action);
		color: var(--color-on-action);
	}
</style>
