<!--
	The + button and its menu of things Baby can read. Each shelf drills into its list
	of packs, in place; a shelf with nothing on it is disabled.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import Icon from './Icon.svelte';
	import Menu from './Menu.svelte';

	interface MenuPack {
		id: string;
		title: string;
		/** Baby has read it, so it’s marked. */
		read: boolean;
	}

	interface MenuShelf {
		title: string;
		/** A curriculum: packs are numbered in reading order. */
		ordered: boolean;
		packs: MenuPack[];
	}

	interface Props {
		disabled?: boolean;
		shelves: MenuShelf[];
		onopen: (packId: string) => void;
	}

	let { disabled = false, shelves, onopen }: Props = $props();

	let list: HTMLElement | undefined = $state();
	/** The shelf being browsed, or none for the top level. */
	let browsing: number | undefined = $state();
	const shelf = $derived(browsing === undefined ? undefined : shelves[browsing]);

	/** Switches level, keeping keyboard focus in the menu. */
	async function browse(index: number | undefined) {
		browsing = index;
		await tick();
		list?.querySelector('button')?.focus();
	}
</script>

<Menu
	icon="plus"
	label="Give Baby something to read"
	placement="above-start"
	{disabled}
	onopen={() => (browsing = undefined)}
>
	{#snippet children(close)}
		<ul bind:this={list}>
			{#if shelf}
				<li>
					<button class="back" onclick={() => browse(undefined)}>
						<Icon name="back" />
						{shelf.title}
					</button>
				</li>
				{#each shelf.packs as pack, index (pack.id)}
					<li>
						<button
							onclick={() => {
								close();
								onopen(pack.id);
							}}
						>
							{shelf.ordered ? `${index + 1}. ${pack.title}` : pack.title}
							{#if pack.read}
								<span class="mark" aria-label="Read"><Icon name="check" /></span>
							{/if}
						</button>
					</li>
				{/each}
			{:else}
				{#each shelves as shelf, index (shelf.title)}
					<li>
						<button disabled={shelf.packs.length === 0} onclick={() => browse(index)}>
							{shelf.title}
							<Icon name="forward" />
						</button>
					</li>
				{/each}
				<!-- Shown so the menu’s shape is clear, but not built yet. -->
				<li><button disabled>Upload text files</button></li>
				<li><button disabled>Read from URL</button></li>
			{/if}
		</ul>
	{/snippet}
</Menu>

<style>
	.back {
		justify-content: flex-start;
		color: var(--color-text-muted);
	}

	.mark {
		color: var(--color-text-muted);
	}
</style>
