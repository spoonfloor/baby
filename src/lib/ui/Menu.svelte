<!--
	An icon button that opens a menu. Uses the native popover, which gives light
	dismiss and Escape for free. Rows are `Row`s in a list; `children` gets a function
	that closes the menu.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconButton from './IconButton.svelte';
	import type { IconName } from './icons.ts';
	import Surface from './Surface.svelte';

	interface Props {
		icon: IconName;
		label: string;
		disabled?: boolean;
		/** Opens above the button, from its start edge (+ menu) or its end edge (settings). */
		placement: 'above-start' | 'above-end';
		children: Snippet<[close: () => void]>;
	}

	let { icon, label, disabled = false, placement, children }: Props = $props();

	const id = $props.id();
	let anchor: HTMLElement;
	let menu: HTMLElement;

	function onbeforetoggle(event: ToggleEvent) {
		if (event.newState !== 'open') return;
		const { left, right, top } = anchor.getBoundingClientRect();
		menu.style.bottom = `${window.innerHeight - top}px`;
		if (placement === 'above-start') menu.style.left = `${left}px`;
		else menu.style.right = `${document.documentElement.clientWidth - right}px`;
	}
</script>

<span bind:this={anchor}>
	<IconButton {icon} {label} popovertarget={id} {disabled} />
</span>

<div bind:this={menu} {id} popover="auto" {onbeforetoggle}>
	<Surface>
		{@render children(() => menu.hidePopover())}
	</Surface>
</div>

<style>
	[popover] {
		position: fixed;
		inset: auto;
		width: var(--width-menu);
		margin: 0 0 var(--space-tight);
		padding: 0;
		border: none;
		background: none;
		color: var(--color-text);
		overflow: visible;
	}

	[popover] :global(ul) {
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
