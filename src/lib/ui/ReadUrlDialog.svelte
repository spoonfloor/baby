<!--
	Asks for the address of a page or a feed to read. Fetching goes through the save
	server, so without one connected it offers to connect one instead. When the site
	refused the server but would likely send the page to a person (`saved`), it offers
	the way around: open the page in the browser, then save it and choose the saved
	file, or (`by: 'paste'`, for phones) copy its text and paste it here.
-->
<script lang="ts">
	import ActionNote from './ActionNote.svelte';
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';
	import TextField from './TextField.svelte';
	import type { Pasted } from '#lib/web/savedPage.ts';

	interface Props {
		address: string;
		/** A save server is connected, so pages can be fetched. */
		connected: boolean;
		working?: string | undefined;
		problem?: string | undefined;
		/**
		 * The site refused the server; offer to read a copy of `url` from the browser: a
		 * saved file of a type `accept` lists (as the file input’s attribute), or pasted text.
		 */
		saved?: ({ url: string } & ({ by: 'file'; accept: string } | { by: 'paste' })) | undefined;
		onnext: () => void;
		/** Connect server was chosen. */
		onconnect: () => void;
		/** A saved copy of the page was chosen. */
		onfile?: ((file: File) => void) | undefined;
		/** The page’s text was pasted, then Next chosen. */
		onpasted?: ((pasted: Pasted) => void) | undefined;
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
		onpasted,
		onclose
	}: Props = $props();

	const ready = $derived(address.trim() !== '' && working === undefined);
	let picker: HTMLInputElement | undefined = $state();

	function submit() {
		if (ready) onnext();
	}

	let pastedText = $state('');
	/**
	 * The HTML the text was pasted as, so paragraphs come from the page’s markup. Kept
	 * only while the field holds exactly that one paste.
	 */
	let pastedHtml: string | undefined;
	const pasteReady = $derived(pastedText.trim() !== '' && working === undefined);

	function onpaste(event: ClipboardEvent) {
		pastedHtml =
			pastedText === '' ? event.clipboardData?.getData('text/html') || undefined : undefined;
	}

	function oninput(event: Event) {
		if (event instanceof InputEvent && event.inputType !== 'insertFromPaste') {
			pastedHtml = undefined;
		}
	}

	function submitPasted() {
		if (pasteReady) onpasted?.({ text: pastedText, html: pastedHtml });
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
						{#if saved.by === 'file'}
							Your browser can likely still open it. Save the page from there, then choose the saved
							file.
						{:else}
							Your browser can likely still open it. Copy the page’s text from there, then paste it
							here.
						{/if}
					</p>
				{/if}
			</div>
			{#if saved?.by === 'file'}
				<input bind:this={picker} type="file" accept={saved.accept} hidden onchange={picked} />
			{:else if saved?.by === 'paste'}
				<div {onpaste} {oninput}>
					<TextField label="Page text" rows={6} bind:value={pastedText} />
				</div>
			{/if}
		</div>
	{/if}
	{#snippet actions(close)}
		<Button onclick={close}>Cancel</Button>
		{#if connected && saved}
			<Button onclick={() => window.open(saved.url, '_blank', 'noopener')}>Open page</Button>
			{#if saved.by === 'file'}
				<Button primary disabled={working !== undefined} onclick={() => picker?.click()}>
					Choose file
				</Button>
			{:else}
				<Button primary disabled={!pasteReady} onclick={submitPasted}>Next</Button>
			{/if}
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
