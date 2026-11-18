<!--
	Asks for the address of a page or a feed to read. Fetching goes through the save
	server, so without one connected it offers to connect one instead.
-->
<script lang="ts">
	import ActionNote from './ActionNote.svelte';
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';
	import TextField from './TextField.svelte';

	interface Props {
		address: string;
		/** A save server is connected, so pages can be fetched. */
		connected: boolean;
		working?: string | undefined;
		problem?: string | undefined;
		onnext: () => void;
		/** Connect server was chosen. */
		onconnect: () => void;
		onclose: () => void;
	}

	let {
		address = $bindable(),
		connected,
		working,
		problem,
		onnext,
		onconnect,
		onclose
	}: Props = $props();

	const ready = $derived(address.trim() !== '' && working === undefined);

	function submit() {
		if (ready) onnext();
	}
</script>

<Dialog
	title="Read from URL"
	size="narrow"
	line={connected
		? { meta: 'A page, or a feed of posts' }
		: { description: 'Reading from a URL uses your save server to fetch the page.' }}
	{onclose}
>
	{#if connected}
		<div class="fields">
			<TextField
				label="Address"
				bind:value={address}
				placeholder="https://example.com/post"
				inputmode="url"
				autocapitalize="off"
				autocomplete="url"
				spellcheck="false"
				autofocus
				onsubmit={submit}
			/>
			<ActionNote {working} {problem} />
		</div>
	{/if}
	{#snippet actions(close)}
		<Button onclick={close}>Cancel</Button>
		{#if connected}
			<Button primary disabled={!ready} onclick={submit}>Next</Button>
		{:else}
			<Button primary onclick={onconnect}>Connect server</Button>
		{/if}
	{/snippet}
</Dialog>

<style>
	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-section);
	}
</style>
