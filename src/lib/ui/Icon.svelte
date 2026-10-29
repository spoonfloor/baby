<script lang="ts">
	import { icons, type IconName } from './icons.ts';

	/** `small` sits inline with a label, e.g. a group’s chevron. */
	let { name, small = false }: { name: IconName; small?: boolean } = $props();
</script>

<svg viewBox="0 0 24 24" aria-hidden="true" class={{ small }}>
	<path d={icons[name]} />
</svg>

<style>
	svg {
		display: block;
		width: var(--size-icon);
		height: var(--size-icon);
		fill: none;
		stroke: currentcolor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.small {
		width: var(--size-icon-small);
		height: var(--size-icon-small);
	}
</style>
