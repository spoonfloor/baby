<!--
	Asks before doing something that can’t be taken back. Cancel comes first, so it has
	focus; the action is the one primary button. An `alternative` is a second way to go
	ahead, between the two.
-->
<script lang="ts">
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';

	interface Props {
		title: string;
		description: string;
		/** The primary button: what confirming does, e.g. “Reset”. */
		confirm: string;
		alternative?: { label: string; onclick: () => void } | undefined;
		onconfirm: () => void;
		onclose: () => void;
	}

	let { title, description, confirm, alternative, onconfirm, onclose }: Props = $props();
</script>

<Dialog {title} size="narrow" line={{ description }} {onclose}>
	{#snippet actions(close)}
		<Button onclick={close}>Cancel</Button>
		{#if alternative}
			<Button onclick={alternative.onclick}>{alternative.label}</Button>
		{/if}
		<Button primary onclick={onconfirm}>{confirm}</Button>
	{/snippet}
</Dialog>
