<!--
	A modal dialog: a title, a line under it, optional content, and actions at the
	end. The line is either the message itself (`description`, in full text color) or
	secondary information about the content (`meta`, muted). It opens when mounted;
	Escape, a click outside, or an action calling `close` closes it, then `onclose` runs.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Surface from './Surface.svelte';

	interface Props {
		title: string;
		/** Narrow for a confirmation; wide for a dialog showing content. */
		size: 'narrow' | 'wide';
		/** The line under the title: the message itself, or secondary information. */
		line: { description: string } | { meta: string };
		/** Content between the line and the actions; scrolls if long. */
		children?: Snippet;
		/** The buttons, given a function that closes the dialog. */
		actions: Snippet<[close: () => void]>;
		onclose: () => void;
	}

	let { title, size, line, children, actions, onclose }: Props = $props();

	const id = $props.id();
	let dialog: HTMLDialogElement;

	$effect(() => {
		dialog.showModal();
	});

	function onclick(event: MouseEvent) {
		if (event.target === dialog) dialog.close();
	}
</script>

<dialog bind:this={dialog} class={size} {onclick} {onclose} aria-labelledby={id}>
	<Surface roomy>
		<div class="layout">
			<header>
				<h2 {id}>{title}</h2>
				{#if 'meta' in line}
					<p class="meta">{line.meta}</p>
				{:else}
					<p>{line.description}</p>
				{/if}
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
		padding: 0;
		border: none;
		background: none;
		color: inherit;
	}

	.narrow {
		max-width: var(--width-dialog-narrow);
	}

	.wide {
		max-width: var(--width-dialog-wide);
	}

	dialog::backdrop {
		background: var(--color-backdrop);
	}

	.layout {
		display: flex;
		flex-direction: column;
		gap: var(--space-section);
		max-height: var(--height-dialog-max);
	}

	header {
		display: flex;
		flex-direction: column;
		gap: var(--space-heading);
	}

	h2,
	p {
		margin: 0;
	}

	.meta {
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
