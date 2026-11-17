<!--
	A modal preview of something Baby can read: its name, what reading it would add,
	and the exact text Baby will train on.
-->
<script lang="ts">
	import type { Document } from '#lib/baby/index.ts';
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';
	import ScriptText from './ScriptText.svelte';

	interface Props {
		title: string;
		/** Where it comes from, when it’s adapted: “Inspired by ELIZA (1966)”. */
		credit?: string | undefined;
		/** What reading would add, e.g. “412 words · 38 new”. */
		summary: string;
		documents: Document[];
		/** Baby has read this before, so reading it is reading it again. */
		read?: boolean;
		/** Reads it; without one, it can only be looked at (a day of replies the user taught). */
		onread?: (() => void) | undefined;
		onclose: () => void;
	}

	let { title, credit, summary, documents, read = false, onread, onclose }: Props = $props();
</script>

<Dialog {title} size="wide" line={{ meta: credit ? `${credit} · ${summary}` : summary }} {onclose}>
	<ScriptText {documents} />
	{#snippet actions(close)}
		{#if onread}
			<Button onclick={close}>Cancel</Button>
			<Button primary onclick={onread}>{read ? 'Train again' : 'Train'}</Button>
		{:else}
			<Button onclick={close}>Close</Button>
		{/if}
	{/snippet}
</Dialog>
