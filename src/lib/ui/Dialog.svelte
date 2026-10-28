<!--
	A modal dialog: a title, a line of explanation under it, optional content, and
	actions at the end. It opens when mounted; Escape, a click outside, or an action
	calling `close` closes it, then `onclose` runs.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Surface from './Surface.svelte';

	interface Props {
		title: string;
		description: string;
		/** Content between the explanation and the actions; scrolls if long. */
		children?: Snippet;
		/** The buttons, given a function that closes the dialog. */
		actions: Snippet<[close: () => void]>;
		onclose: () => void;
	}

	let { title, description, children, actions, onclose }: Props = $props();

	const id = $props.id();
	let dialog: HTMLDialogElement;

	$effect(() => {
		dialog.showModal();
	});

	function onclick(event: MouseEvent) {
		if (event.target === dialog) dialog.close();
	}
</script>

<dialog bind:this={dialog} {onclick} {onclose} aria-labelledby={id}>
	<Surface>
		<div class="layout">
			<header>
				<h2 {id}>{title}</h2>
				<p>{description}</p>
			</header>
			{#if children}
				<div class="body">
					{@render children()}
				</div>
			{/if}
			<footer>
				{@render actions(() => dialog.close())}
			</footer>
		</div>
	</Surface>
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

	.layout {
		display: flex;
		flex-direction: column;
		gap: var(--space-surface-block);
		max-height: var(--height-dialog-max);
	}

	h2 {
		margin: 0;
		font-size: inherit;
	}

	header p {
		margin: 0;
		color: var(--color-text-muted);
	}

	.body {
		overflow-y: auto;
	}

	footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-tight);
	}
</style>
