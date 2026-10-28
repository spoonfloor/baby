<!-- A text button. `primary` is the one action a view is asking for; the rest are plain. -->
<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		primary?: boolean;
	}

	let { primary = false, type = 'button', children, ...rest }: Props = $props();
</script>

<button {type} class={{ primary }} {...rest}>
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

	.primary {
		background: var(--color-action);
		color: var(--color-on-action);
	}
</style>
