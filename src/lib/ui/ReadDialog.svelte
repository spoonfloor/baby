<!-- A modal for pasting text for Baby to read. Escape or a click outside closes it. -->
<script lang="ts">
	import Composer from './Composer.svelte';

	let { onread }: { onread: (text: string) => void } = $props();

	let dialog: HTMLDialogElement;

	export function show() {
		dialog.showModal();
	}

	function read(text: string) {
		dialog.close();
		onread(text);
	}

	function onclick(event: MouseEvent) {
		if (event.target === dialog) dialog.close();
	}
</script>

<dialog bind:this={dialog} {onclick} aria-label="Give Baby something to read">
	<Composer placeholder="Paste something for Baby to read" onsend={read} />
</dialog>

<style>
	dialog {
		width: calc(100% - 2 * var(--space-gutter));
		max-width: var(--width-content);
		padding: 0;
		border: none;
		background: none;
		color: inherit;
	}

	dialog::backdrop {
		background: var(--color-backdrop);
	}
</style>
