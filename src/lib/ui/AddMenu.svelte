<!--
	The + button and its menu of things Baby can read. Each shelf drills into its list
	of packs, in place; a shelf with nothing on it is disabled. Uses the native
	popover, which gives light dismiss and Escape for free.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import Icon from './Icon.svelte';
	import IconButton from './IconButton.svelte';
	import Surface from './Surface.svelte';

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

	const id = $props.id();
	let anchor: HTMLElement;
	let menu: HTMLElement;
	/** The shelf being browsed, or none for the top level. */
	let browsing: number | undefined = $state();
	const shelf = $derived(browsing === undefined ? undefined : shelves[browsing]);

	// Open upward from the + button, aligned to its left edge; start at the top level.
	function onbeforetoggle(event: ToggleEvent) {
		if (event.newState !== 'open') return;
		browsing = undefined;
		const { left, top } = anchor.getBoundingClientRect();
		menu.style.left = `${left}px`;
		menu.style.bottom = `${window.innerHeight - top}px`;
	}

	/** Switches level, keeping keyboard focus in the menu. */
	async function browse(index: number | undefined) {
		browsing = index;
		await tick();
		menu.querySelector('button')?.focus();
	}

	function open(packId: string) {
		menu.hidePopover();
		onopen(packId);
	}
</script>

<span bind:this={anchor}>
	<IconButton icon="plus" label="Give Baby something to read" popovertarget={id} {disabled} />
</span>

<div bind:this={menu} {id} popover="auto" {onbeforetoggle}>
	<Surface>
		<ul>
			{#if shelf}
				<li>
					<button class="back" onclick={() => browse(undefined)}>
						<Icon name="back" />
						{shelf.title}
					</button>
				</li>
				{#each shelf.packs as pack, index (pack.id)}
					<li>
						<button onclick={() => open(pack.id)}>
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
	</Surface>
</div>

<style>
	[popover] {
		position: fixed;
		inset: auto;
		width: var(--width-menu);
		margin: 0 0 var(--space-tight);
		padding: 0;
		border: none;
		background: none;
		color: var(--color-text);
		overflow: visible;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-inline);
		width: 100%;
		padding: var(--space-control-block) 0;
		border: none;
		background: none;
		text-align: start;
		cursor: pointer;
	}

	button:disabled {
		color: var(--color-text-muted);
		cursor: default;
	}

	.back {
		justify-content: flex-start;
		color: var(--color-text-muted);
	}

	.mark {
		color: var(--color-text-muted);
	}
</style>
