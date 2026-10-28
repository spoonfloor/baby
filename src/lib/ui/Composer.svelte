<!--
	Where the user types. Enter sends, Shift+Enter adds a line; the field grows with
	its text. Typing is always allowed, but sending waits until `ready`.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconButton from './IconButton.svelte';
	import Surface from './Surface.svelte';

	interface Props {
		placeholder: string;
		ready?: boolean;
		value?: string;
		/** Controls shown before the field, e.g. the + menu. */
		start?: Snippet;
		onsend: (text: string) => void;
	}

	let { placeholder, ready = true, value = $bindable(''), start, onsend }: Props = $props();

	let field: HTMLTextAreaElement;
	const canSend = $derived(ready && value.trim() !== '');

	// Fit the field to its text. Reads `value` so it also re-fits when cleared after sending.
	$effect(() => {
		void value;
		field.style.height = 'auto';
		field.style.height = `${field.scrollHeight}px`;
	});

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
	</div>
</Surface>

<style>
	.row {
		display: flex;
		align-items: flex-end;
		gap: var(--space-inline);
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
