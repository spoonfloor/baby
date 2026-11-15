<!--
	A button that is just an icon, one line of text tall so it sits level with the text
	beside it. `inline`, it’s small and sits in a line of text, e.g. right after a word.
-->
<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';
	import type { IconName } from './icons.ts';

	interface Props extends HTMLButtonAttributes {
		icon: IconName;
		label: string;
		inline?: boolean;
	}

	let { icon, label, inline = false, type = 'button', ...rest }: Props = $props();
</script>

<button {type} aria-label={label} class={{ inline }} {...rest}>
	<Icon name={icon} small={inline} />
</button>

<style>
	button {
		display: grid;
		place-items: center;
		block-size: 1lh;
		padding: 0;
		border: none;
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.inline {
		display: inline-grid;
		vertical-align: top;
		margin-inline-start: var(--space-inline-tight);
	}

	button:disabled {
		cursor: default;
	}
</style>
