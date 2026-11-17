<!-- Connects a save server: its address and the token it was started with. -->
<script lang="ts">
	import ActionNote from './ActionNote.svelte';
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';
	import TextField from './TextField.svelte';

	interface Props {
		address: string;
		token: string;
		working?: string | undefined;
		problem?: string | undefined;
		onconnect: () => void;
		onclose: () => void;
	}

	let {
		address = $bindable(),
		token = $bindable(),
		working,
		problem,
		onconnect,
		onclose
	}: Props = $props();

	const ready = $derived(address.trim() !== '' && token.trim() !== '' && working === undefined);

	function submit() {
		if (ready) onconnect();
	}
</script>

<Dialog
	title="Connect server"
	size="narrow"
	line={{ meta: 'Saves on your server open on every device connected to it.' }}
	{onclose}
>
	<div class="fields">
		<TextField
			label="Address"
			bind:value={address}
			placeholder="https://baby.example.com"
			inputmode="url"
			autocapitalize="off"
			autocomplete="url"
			spellcheck="false"
			autofocus
			onsubmit={submit}
		/>
		<TextField
			label="Token"
			type="password"
			bind:value={token}
			autocomplete="off"
			onsubmit={submit}
		/>
		<ActionNote {working} {problem} />
	</div>
	{#snippet actions(close)}
		<Button onclick={close}>Cancel</Button>
		<Button primary disabled={!ready} onclick={submit}>Connect</Button>
	{/snippet}
</Dialog>

<style>
	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-section);
	}
</style>
