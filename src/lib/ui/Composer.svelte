<!--
	Where the user types. Enter sends, Shift+Enter adds a line; the field grows with
	its text. Typing is always allowed, but sending waits until `ready`. A `note` above
	the field says what sending will do differently, with ✕ to go back to normal, and
	its `picks` are lines to send with a tap instead of typing.
	With `catchTyping`, typing anywhere on the page types here (see `catchKey`).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconButton from './IconButton.svelte';
	import Row from './Row.svelte';
	import Surface from './Surface.svelte';

	interface Props {
		placeholder: string;
		ready?: boolean;
		value?: string;
		note?:
			| {
					text: string;
					oncancel: () => void;
					/** Lines to send with a tap, listed under the note; `label` names the list. */
					picks?: { label: string; options: readonly string[] };
			  }
			| undefined;
		/** Typing a character anywhere else on the page types it here: for the page’s one main field. */
		catchTyping?: boolean;
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
		catchTyping = false,
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

	/**
	 * Moves focus here, caret at the end, when a character is typed with nothing else
	 * taking it, so the character lands here. Only characters: arrows, Space, Enter,
	 * Tab and Escape, and anything with Cmd, Ctrl or Alt, do what they always do. Not
	 * from another field, nor while a dialog or menu is open.
	 */
	function catchKey(event: KeyboardEvent) {
		if (!catchTyping || event.defaultPrevented || event.isComposing) return;
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if ([...event.key].length !== 1 || event.key === ' ') return;
		const { target } = event;
		if (
			target instanceof HTMLElement &&
			(target.isContentEditable || target.closest('input, textarea, select, dialog, [popover]'))
		)
			return;
		if (document.querySelector('dialog[open], :popover-open')) return;
		field.setSelectionRange(field.value.length, field.value.length);
		field.focus();
	}

	function onsubmit(event: SubmitEvent) {
		event.preventDefault();
		send();
	}
</script>

<svelte:window onkeydown={catchKey} />

<Surface as="form" {onsubmit}>
	{#if note}
		<div class="note">
			<p>{note.text}</p>
			<IconButton icon="close" label="Cancel" onclick={note.oncancel} />
		</div>
		{#if note.picks && note.picks.options.length > 0}
			<ul class="picks" aria-label={note.picks.label}>
				{#each note.picks.options as option (option)}
					<li><Row disabled={!ready} onclick={() => onsend(option)}>{option}</Row></li>
				{/each}
			</ul>
		{/if}
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

	/* Label-sized and one line, so it reads as context for the field, not a second placeholder. */
	.note {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-inline);
		margin-block-end: var(--space-tight);
		color: var(--color-text-muted);
		font-size: var(--font-size-label);
	}

	.note p {
		min-width: 0;
		margin: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.picks {
		margin: 0 0 var(--space-tight);
		padding: 0;
		list-style: none;
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
