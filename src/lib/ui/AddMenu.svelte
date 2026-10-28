<!--
	The + button and its menu of things Baby can read. Uses the native popover, which
	gives light dismiss and Escape for free.
-->
<script lang="ts">
	import IconButton from './IconButton.svelte';
	import Surface from './Surface.svelte';

	interface Props {
		disabled?: boolean;
		onpaste: () => void;
	}

	let { disabled = false, onpaste }: Props = $props();

	const id = $props.id();
	let anchor: HTMLElement;
	let menu: HTMLElement;

	// Open upward from the + button, aligned to its left edge.
	function place(event: ToggleEvent) {
		if (event.newState !== 'open') return;
		const { left, top } = anchor.getBoundingClientRect();
		menu.style.left = `${left}px`;
		menu.style.bottom = `${window.innerHeight - top}px`;
	}

	function choose(action: () => void) {
		menu.hidePopover();
		action();
	}
</script>

<span bind:this={anchor}>
	<IconButton icon="plus" label="Give Baby something to read" popovertarget={id} {disabled} />
</span>

<div bind:this={menu} {id} popover="auto" onbeforetoggle={place}>
	<Surface>
		<button onclick={() => choose(onpaste)}>Paste text</button>
	</Surface>
</div>

<style>
	[popover] {
		position: fixed;
		inset: auto;
		margin: 0 0 var(--space-tight);
		padding: 0;
		border: none;
		background: none;
		color: var(--color-text);
		overflow: visible;
	}

	button {
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
	}
</style>
