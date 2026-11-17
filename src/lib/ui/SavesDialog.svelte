<!--
	Saved models, grouped by where they’re kept: this device, then a server. Clicking a
	save picks it and shows what can be done with it. Without a server, its group
	offers to connect one. In select mode (`checked` given), clicking a save checks it
	instead, for deleting several at once. A line under everything says what’s
	happening or what went wrong.
-->
<script lang="ts" module>
	export interface SaveRow {
		id: string;
		name: string;
		/** The save at a glance, e.g. “412 words · 3 sources · today”. */
		meta: string;
	}
</script>

<script lang="ts">
	import type { Place, SaveKey } from '#lib/saves/store.ts';
	import ActionNote from './ActionNote.svelte';
	import Button from './Button.svelte';
	import Check from './Check.svelte';
	import Dialog from './Dialog.svelte';
	import Row from './Row.svelte';

	interface Props {
		/** The line under the title: whether the current model is saved. */
		status: string;
		device: SaveRow[];
		/** The connected server, or undefined if none is. */
		server?: { host: string; saves: SaveRow[]; problem?: string | undefined } | undefined;
		/** The save whose actions are showing. */
		picked?: SaveKey | undefined;
		/** In select mode, the saves checked so far; undefined otherwise. */
		checked?: SaveKey[] | undefined;
		/** What’s under way, e.g. “Loading “Mine””; actions wait until it’s done. */
		working?: string | undefined;
		/** What went wrong with the last action, in the app’s voice. */
		problem?: string | undefined;
		onpick: (save: SaveKey) => void;
		onload: (save: SaveKey) => void;
		onrename: (save: SaveKey) => void;
		onmove: (save: SaveKey) => void;
		ondelete: (save: SaveKey) => void;
		onsave: () => void;
		onconnect: () => void;
		ondisconnect: () => void;
		/** Select was chosen: the caller enters select mode with nothing checked. */
		onselect: () => void;
		/** A save was checked or unchecked in select mode. */
		oncheck: (save: SaveKey) => void;
		/** Deleting the checked saves was asked for; the caller confirms first. */
		ondeletechecked: () => void;
		/** Select mode was left without deleting. */
		onstopselecting: () => void;
		onclose: () => void;
	}

	let {
		status,
		device,
		server,
		picked,
		checked,
		working,
		problem,
		onpick,
		onload,
		onrename,
		onmove,
		ondelete,
		onsave,
		onconnect,
		ondisconnect,
		onselect,
		oncheck,
		ondeletechecked,
		onstopselecting,
		onclose
	}: Props = $props();

	const busy = $derived(working !== undefined);
	const selecting = $derived(checked !== undefined);
	const same = (a: SaveKey | undefined, b: SaveKey) => a?.place === b.place && a.id === b.id;
	const isChecked = (key: SaveKey) => checked?.some((other) => same(other, key)) ?? false;
	const hasSaves = $derived(device.length > 0 || (server?.saves.length ?? 0) > 0);
</script>

{#snippet list(place: Place, saves: SaveRow[], empty: string)}
	{#if saves.length === 0}
		<p class="muted">{empty}</p>
	{:else}
		<ul>
			{#each saves as save (save.id)}
				{@const key = { place, id: save.id }}
				{@const open = !selecting && same(picked, key)}
				<li class={{ picked: open }}>
					{#if selecting}
						{@const on = isChecked(key)}
						<Row aria-pressed={on} disabled={busy} onclick={() => oncheck(key)}>
							<span class="choice">
								<Check checked={on} />
								<span class="save">
									{save.name}
									<span class="muted">{save.meta}</span>
								</span>
							</span>
						</Row>
					{:else}
						<Row aria-expanded={open} onclick={() => onpick(key)}>
							<span class="save">
								{save.name}
								<span class="muted">{save.meta}</span>
							</span>
						</Row>
					{/if}
					{#if open}
						<div class="actions">
							<Button primary disabled={busy} onclick={() => onload(key)}>Load</Button>
							<Button disabled={busy} onclick={() => onrename(key)}>Rename</Button>
							{#if server}
								<Button disabled={busy} onclick={() => onmove(key)}>
									{place === 'device' ? 'Move to server' : 'Move to this device'}
								</Button>
							{/if}
							<Button disabled={busy} onclick={() => ondelete(key)}>Delete</Button>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

{#snippet selectButton()}
	{#if selecting}
		<span class="muted">{checked?.length ?? 0} selected</span>
	{:else if hasSaves}
		<Button inline disabled={busy} onclick={onselect}>Select</Button>
	{/if}
{/snippet}

<Dialog
	title={selecting ? 'Select saves' : 'Saves'}
	size="narrow"
	line={{ meta: selecting ? 'Click saves to select them.' : status }}
	aside={selectButton}
	{onclose}
>
	<div class="groups">
		<section>
			<h3>On this device</h3>
			{@render list('device', device, 'Nothing saved on this device yet.')}
		</section>
		<section>
			{#if server}
				<div class="heading">
					<h3>On {server.host}</h3>
					{#if !selecting}
						<Button inline disabled={busy} onclick={ondisconnect}>Disconnect</Button>
					{/if}
				</div>
				<ActionNote problem={server.problem} />
				{#if !server.problem || server.saves.length > 0}
					{@render list('server', server.saves, 'Nothing saved on this server yet.')}
				{/if}
			{:else if !selecting}
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
		{#if selecting}
			<Button onclick={onstopselecting}>Cancel</Button>
			<Button primary disabled={busy || !checked?.length} onclick={ondeletechecked}>
				Delete {checked?.length ?? 0}
			</Button>
		{:else}
			<Button onclick={close}>Close</Button>
			<Button primary disabled={busy} onclick={onsave}>Save current model</Button>
		{/if}
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

	.choice {
		display: flex;
		align-items: center;
		gap: var(--space-heading);
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
