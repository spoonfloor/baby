<!--
	A labeled one-line text field, recessed into the surface it sits on. Enter submits
	(`onsubmit`), so a dialog’s main action works from the keyboard.
-->
<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'value' | 'onsubmit'> {
		label: string;
		value: string;
		onsubmit?: () => void;
	}

	let { label, value = $bindable(), onsubmit, type = 'text', ...rest }: Props = $props();

	const id = $props.id();

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.isComposing && onsubmit) {
			event.preventDefault();
			onsubmit();
		}
	}
</script>

<div class="field">
	<label for={id}>{label}</label>
	<input {id} {type} bind:value {onkeydown} {...rest} />
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-subtitle);
	}

	label {
		color: var(--color-text-muted);
		font-size: var(--font-size-label);
	}

	input {
		padding: var(--space-control-block) var(--space-control-block);
		border: none;
		border-radius: var(--radius-field);
		background: var(--color-field);
		color: var(--color-text);
	}
</style>
