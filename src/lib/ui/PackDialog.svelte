<!--
	A modal preview of something Baby can read: its name, what reading it would add,
	and the exact text Baby will train on. It opens when mounted; Escape, a click
	outside, or Cancel closes it.
-->
<script lang="ts">
	import type { Document } from '#lib/baby/index.ts';
	import Button from './Button.svelte';
	import ScriptText from './ScriptText.svelte';
	import Surface from './Surface.svelte';

	interface Props {
		title: string;
		/** What reading would add, e.g. “412 words · 38 new”. */
		summary: string;
		documents: Document[];
		/** Baby has read this before, so reading it is reading it again. */
		read: boolean;
		onread: () => void;
		onclose: () => void;
	}

	let { title, summary, documents, read, onread, onclose }: Props = $props();

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
				<p>{summary}</p>
			</header>
			<div class="body">
				<ScriptText {documents} />
			</div>
			<footer>
				<Button onclick={() => dialog.close()}>Cancel</Button>
				<Button primary onclick={onread}>{read ? 'Read again' : 'Read'}</Button>
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
