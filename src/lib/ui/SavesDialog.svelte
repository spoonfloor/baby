<!--
	Saved models, grouped by where they’re kept: this device, then a server. Clicking a
	save picks it and shows what can be done with it. Without a server, its group
	offers to connect one. A line under everything says what’s happening or what went wrong.
-->
<script lang="ts" module>
	export type SavePlace = 'device' | 'server';

	export interface SaveRow {
		id: string;
		name: string;
		/** The save at a glance, e.g. “412 words · 3 sources · today”. */
		meta: string;
	}
</script>

<script lang="ts">
	import ActionNote from './ActionNote.svelte';
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';
	import Row from './Row.svelte';

	interface Props {
		/** The line under the title: whether the current model is saved. */
		status: string;
		device: SaveRow[];
		/** The connected server, or undefined if none is. */
		server?: { host: string; saves: SaveRow[]; problem?: string | undefined } | undefined;
		selected?: { place: SavePlace; id: string } | undefined;
		/** What’s under way, e.g. “Loading “Mine””; actions wait until it’s done. */
		working?: string | undefined;
		/** What went wrong with the last action, in the app’s voice. */
		problem?: string | undefined;
		onselect: (place: SavePlace, id: string) => void;
		onload: (place: SavePlace, id: string) => void;
		onrename: (place: SavePlace, id: string) => void;
		onmove: (place: SavePlace, id: string) => void;
		ondelete: (place: SavePlace, id: string) => void;
		onsave: () => void;
		onconnect: () => void;
		ondisconnect: () => void;
		onclose: () => void;
	}

	let {
		status,
		device,
		server,
		selected,
		working,
		problem,
		onselect,
		onload,
		onrename,
		onmove,
		ondelete,
		onsave,
		onconnect,
		ondisconnect,
		onclose
	}: Props = $props();

	const busy = $derived(working !== undefined);
</script>

{#snippet list(place: SavePlace, saves: SaveRow[], empty: string)}
	{#if saves.length === 0}
		<p class="muted">{empty}</p>
	{:else}
		<ul>
			{#each saves as save (save.id)}
				{@const picked = selected?.place === place && selected.id === save.id}
				<li class={{ picked }}>
					<Row aria-expanded={picked} onclick={() => onselect(place, save.id)}>
						<span class="save">
							{save.name}
							<span class="muted">{save.meta}</span>
						</span>
					</Row>
					{#if picked}
						<div class="actions">
							<Button primary disabled={busy} onclick={() => onload(place, save.id)}>Load</Button>
							<Button disabled={busy} onclick={() => onrename(place, save.id)}>Rename</Button>
							{#if server}
								<Button disabled={busy} onclick={() => onmove(place, save.id)}>
									{place === 'device' ? 'Move to server' : 'Move to this device'}
								</Button>
							{/if}
							<Button disabled={busy} onclick={() => ondelete(place, save.id)}>Delete</Button>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

<Dialog title="Saves" size="narrow" line={{ meta: status }} {onclose}>
	<div class="groups">
		<section>
			<h3>On this device</h3>
			{@render list('device', device, 'Nothing saved on this device yet.')}
		</section>
		<section>
			{#if server}
				<div class="heading">
					<h3>On {server.host}</h3>
					<Button inline disabled={busy} onclick={ondisconnect}>Disconnect</Button>
				</div>
				{#if server.problem}
					<ActionNote problem={server.problem} />
				{:else}
					{@render list('server', server.saves, 'Nothing saved on this server yet.')}
				{/if}
			{:else}
				<h3>On a server</h3>
				<p>Keep saves on your own server to open them on any device.</p>
				<div class="connect">
					<Button disabled={busy} onclick={onconnect}>Connect server</Button>
				</div>
			{/if}
		</section>
		<ActionNote {working} {problem} />
	</div>
	{#snippet actions(close)}
		<Button onclick={close}>Close</Button>
		<Button primary disabled={busy} onclick={onsave}>Save current model</Button>
	{/snippet}
</Dialog>

<style>
	.groups {
		display: flex;
		flex-direction: column;
		gap: var(--space-section);
	}

	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-subtitle);
	}

	h3,
	p {
		margin: 0;
	}

	h3 {
		color: var(--color-text-muted);
		font-size: var(--font-size-label);
		font-weight: var(--font-weight-body);
	}

	.heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-inline);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* A picked save stands out from the rest, with its actions inside. */
	li {
		margin-inline: calc(-1 * var(--space-tight));
		padding-inline: var(--space-tight);
		border-radius: var(--radius-field);
	}

	.picked {
		padding-block-end: var(--space-tight);
		background: var(--color-selected);
	}

	.save {
		display: flex;
		flex-direction: column;
	}

	.muted {
		color: var(--color-text-muted);
		font-size: var(--font-size-label);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-tight);
	}

	.connect {
		margin-block-start: var(--space-tight);
	}
</style>
