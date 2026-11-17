<!--
	Asks before doing something that can’t be taken back. Cancel comes first, so it has
	focus; the action is the one primary button. An `alternative` is a second way to go
	ahead, between the two. `items` lists what it applies to, e.g. the saves to delete,
	each with a muted note after it.
-->
<script lang="ts">
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';

	interface Props {
		title: string;
		description?: string | undefined;
		items?: { key: string; label: string; note?: string }[] | undefined;
		/** The primary button: what confirming does, e.g. “Reset”. */
		confirm: string;
		alternative?: { label: string; onclick: () => void } | undefined;
		onconfirm: () => void;
		onclose: () => void;
	}

	let { title, description, items, confirm, alternative, onconfirm, onclose }: Props = $props();
</script>

{#snippet list()}
	<ul>
		{#each items ?? [] as item (item.key)}
			<li>
				{item.label}
				{#if item.note}<span class="note">· {item.note}</span>{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<Dialog
	{title}
	size="narrow"
	line={description === undefined ? undefined : { description }}
	children={items?.length ? list : undefined}
	{onclose}
>
	{#snippet actions(close)}
		<Button onclick={close}>Cancel</Button>
		{#if alternative}
			<Button onclick={alternative.onclick}>{alternative.label}</Button>
		{/if}
		<Button primary onclick={onconfirm}>{confirm}</Button>
	{/snippet}
</Dialog>

<style>
	ul {
		margin: 0;
		padding-inline-start: var(--space-section);
	}

	.note {
		color: var(--color-text-muted);
	}
</style>
