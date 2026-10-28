<script lang="ts">
	import { icons, type IconName } from './icons.ts';

	let { name }: { name: IconName } = $props();
</script>

<svg viewBox="0 0 24 24" aria-hidden="true">
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
</style>
