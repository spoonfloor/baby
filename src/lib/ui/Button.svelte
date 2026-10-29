<!--
	A text button. `primary` is the one action a view is asking for; the rest are plain.
	`inline` sits in a column of text, aligned with it: no padding.
-->
<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		primary?: boolean;
		inline?: boolean;
	}

	let { primary = false, inline = false, type = 'button', children, ...rest }: Props = $props();
</script>

<button {type} class={{ primary, inline }} {...rest}>
	{@render children?.()}
</button>

<style>
	button {
		padding: var(--space-control-block) var(--space-control-inline);
		border: none;
		border-radius: var(--radius-pill);
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.inline {
		padding: 0;
	}

	.primary {
		background: var(--color-action);
		color: var(--color-on-action);
	}
</style>
