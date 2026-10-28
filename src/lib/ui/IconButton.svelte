<!-- A button that is just an icon, one line of text tall so it sits level with the text beside it. -->
<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';
	import type { IconName } from './icons.ts';

	interface Props extends HTMLButtonAttributes {
		icon: IconName;
		label: string;
	}

	let { icon, label, type = 'button', ...rest }: Props = $props();
</script>

<button {type} aria-label={label} {...rest}>
	<Icon name={icon} />
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

	button:disabled {
		cursor: default;
	}
</style>
