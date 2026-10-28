<!--
	An icon button that opens a menu. Uses the native popover, which gives light
	dismiss and Escape for free. Rows are buttons in a list, styled here so every
	menu’s rows look the same; `children` gets a function that closes the menu.
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
		/** Opens above the button from its start edge (+ menu), or below it from its end edge. */
		placement: 'above-start' | 'below-end';
		/** Called as the menu opens, before it shows. */
		onopen?: () => void;
		children: Snippet<[close: () => void]>;
	}

	let { icon, label, disabled = false, placement, onopen, children }: Props = $props();

	const id = $props.id();
	let anchor: HTMLElement;
	let menu: HTMLElement;

	function onbeforetoggle(event: ToggleEvent) {
		if (event.newState !== 'open') return;
		onopen?.();
		const { left, right, top, bottom } = anchor.getBoundingClientRect();
		if (placement === 'above-start') {
			menu.style.left = `${left}px`;
			menu.style.bottom = `${window.innerHeight - top}px`;
		} else {
			menu.style.right = `${document.documentElement.clientWidth - right}px`;
			menu.style.top = `${bottom}px`;
		}
	}
</script>

<span bind:this={anchor}>
	<IconButton {icon} {label} popovertarget={id} {disabled} />
</span>

<div bind:this={menu} {id} popover="auto" class={placement} {onbeforetoggle}>
	<Surface>
		{@render children(() => menu.hidePopover())}
	</Surface>
</div>

<style>
	[popover] {
		position: fixed;
		inset: auto;
		width: var(--width-menu);
		margin: 0;
		padding: 0;
		border: none;
		background: none;
		color: var(--color-text);
		overflow: visible;
	}

	.above-start {
		margin-block-end: var(--space-tight);
	}

	.below-end {
		margin-block-start: var(--space-tight);
	}

	[popover] :global(ul) {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	[popover] :global(button) {
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

	[popover] :global(button:disabled) {
		color: var(--color-text-muted);
		cursor: default;
	}
</style>
