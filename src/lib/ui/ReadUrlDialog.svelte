<!--
	Asks for the address of a page or a feed to read. Fetching goes through the save
	server, so without one connected it offers to connect one instead. When the site
	refused the server but would likely send the page to a person (`saved`), it offers
	the way around: open the page in the browser, save it, and choose the saved file.
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
		/**
		 * The site refused the server; offer to read a copy of `url` saved from the browser,
		 * in a file of a type `accept` lists (as the file input’s attribute).
		 */
		saved?: { url: string; accept: string } | undefined;
		onnext: () => void;
		/** Connect server was chosen. */
		onconnect: () => void;
		/** A saved copy of the page was chosen. */
		onfile?: ((file: File) => void) | undefined;
		onclose: () => void;
	}

	let {
		address = $bindable(),
		connected,
		working,
		problem,
		saved,
		onnext,
		onconnect,
		onfile,
		onclose
	}: Props = $props();

	const ready = $derived(address.trim() !== '' && working === undefined);
	let picker: HTMLInputElement | undefined = $state();

	function submit() {
		if (ready) onnext();
	}

	function picked() {
		const file = picker?.files?.[0];
		if (picker) picker.value = '';
		if (file) onfile?.(file);
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
			<div class="notes">
				<ActionNote {working} {problem} />
				{#if saved && working === undefined}
					<p>
						Your browser can likely still open it. Save the page from there, then choose the saved
						file.
					</p>
				{/if}
			</div>
			{#if saved}
				<input bind:this={picker} type="file" accept={saved.accept} hidden onchange={picked} />
			{/if}
		</div>
	{/if}
	{#snippet actions(close)}
		<Button onclick={close}>Cancel</Button>
		{#if connected && saved}
			<Button onclick={() => window.open(saved.url, '_blank', 'noopener')}>Open page</Button>
			<Button primary disabled={working !== undefined} onclick={() => picker?.click()}>
				Choose file
			</Button>
		{:else if connected}
			<Button primary disabled={!ready} onclick={submit}>Next</Button>
		{:else}
			<Button primary onclick={onconnect}>Connect server</Button>
		{/if}
	{/snippet}
</Dialog>

<style>
	.fields,
	.notes {
		display: flex;
		flex-direction: column;
	}

	.fields {
		gap: var(--space-section);
	}

	.notes {
		gap: var(--space-heading);
	}

	p {
		margin: 0;
	}
</style>
