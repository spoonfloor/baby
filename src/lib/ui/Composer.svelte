<!--
	Where the user types. Enter sends, Shift+Enter adds a line; the field grows with
	its text. Typing is always allowed, but sending waits until `ready`. A `note` above
	the field says what sending will do differently, with ✕ to go back to normal.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconButton from './IconButton.svelte';
	import Surface from './Surface.svelte';

	interface Props {
		placeholder: string;
		ready?: boolean;
		value?: string;
		note?: { text: string; oncancel: () => void } | undefined;
		/** Controls shown before the field, e.g. the + menu. */
		start?: Snippet;
		/** Controls shown after Send, e.g. the settings gear. */
		end?: Snippet;
		onsend: (text: string) => void;
	}

	let {
		placeholder,
		ready = true,
		value = $bindable(''),
		note,
		start,
		end,
		onsend
	}: Props = $props();

	let field: HTMLTextAreaElement;
	const canSend = $derived(ready && value.trim() !== '');

	// Fit the field to its text. Reads `value` so it also re-fits when cleared after sending.
	$effect(() => {
		void value;
		field.style.height = 'auto';
		field.style.height = `${field.scrollHeight}px`;
	});

	export function focus() {
		field.focus();
	}

	function send() {
		if (!canSend) return;
		onsend(value.trim());
		value = '';
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			send();
		}
	}

	function onsubmit(event: SubmitEvent) {
		event.preventDefault();
		send();
	}
</script>

<Surface as="form" {onsubmit}>
	{#if note}
		<div class="note">
			<p>{note.text}</p>
			<IconButton icon="close" label="Cancel" onclick={note.oncancel} />
		</div>
	{/if}
	<div class="row">
		{@render start?.()}
		<textarea
			bind:this={field}
			bind:value
			{placeholder}
			{onkeydown}
			rows="1"
			aria-label={placeholder}></textarea>
		<IconButton icon="return" label="Send" type="submit" disabled={!canSend} />
		{#if end}
			<div class="end">{@render end()}</div>
		{/if}
	</div>
</Surface>

<style>
	.row {
		display: flex;
		align-items: flex-end;
		gap: var(--space-inline);
	}

	/* Set further from Send, so a tap meant for Send doesn’t land on something else. */
	.end {
		display: flex;
		gap: var(--space-inline);
		margin-inline-start: var(--space-inline);
	}

	.note {
		display: flex;
		justify-content: space-between;
		gap: var(--space-inline);
		margin-block-end: var(--space-tight);
		color: var(--color-text-muted);
	}

	.note p {
		margin: 0;
	}

	textarea {
		flex: 1;
		max-height: var(--height-composer-max);
		padding: 0;
		border: none;
		outline: none;
		background: none;
		resize: none;
		line-height: inherit;
	}

	textarea::placeholder {
		color: var(--color-text-muted);
	}
</style>
