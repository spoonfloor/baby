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
		/** What reading would add, e.g. “412 words · 38 new”. */
		summary: string;
		documents: Document[];
		/** Baby has read this before, so reading it is reading it again. */
		read: boolean;
		onread: () => void;
		onclose: () => void;
	}

	let { title, summary, documents, read, onread, onclose }: Props = $props();
</script>

<Dialog {title} description={summary} {onclose}>
	<ScriptText {documents} />
	{#snippet actions(close)}
		<Button onclick={close}>Cancel</Button>
		<Button primary onclick={onread}>{read ? 'Read again' : 'Read'}</Button>
	{/snippet}
</Dialog>
