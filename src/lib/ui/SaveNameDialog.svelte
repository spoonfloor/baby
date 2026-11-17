<!--
	Names a save: to save the current model (where to, if there’s a choice) or to rename
	one. The line under the title says what confirming will do.
-->
<script lang="ts" generics="Place extends string">
	import ActionNote from './ActionNote.svelte';
	import Button from './Button.svelte';
	import Choice from './Choice.svelte';
	import Dialog from './Dialog.svelte';
	import TextField from './TextField.svelte';

	interface Props {
		title: string;
		/** What confirming will do, e.g. that it replaces a save of the same name. */
		note: string;
		/** The primary button, e.g. “Save” or “Replace”. */
		confirm: string;
		name: string;
		/** Where to save, when there’s more than one place. */
		places?: { value: Place; label: string }[] | undefined;
		place?: Place | undefined;
		working?: string | undefined;
		problem?: string | undefined;
		onconfirm: () => void;
		onclose: () => void;
	}

	let {
		title,
		note,
		confirm,
		name = $bindable(),
		places,
		place = $bindable(),
		working,
		problem,
		onconfirm,
		onclose
	}: Props = $props();

	const ready = $derived(name.trim() !== '' && working === undefined);

	function submit() {
		if (ready) onconfirm();
	}
</script>

<Dialog {title} size="narrow" line={{ meta: note }} {onclose}>
	<div class="fields">
		<TextField label="Name" bind:value={name} autofocus autocomplete="off" onsubmit={submit} />
		{#if places && place !== undefined}
			<Choice label="Save to" options={places} bind:value={place} />
		{/if}
		<ActionNote {working} {problem} />
	</div>
	{#snippet actions(close)}
		<Button onclick={close}>Cancel</Button>
		<Button primary disabled={!ready} onclick={submit}>{confirm}</Button>
	{/snippet}
</Dialog>

<style>
	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-section);
	}
</style>
