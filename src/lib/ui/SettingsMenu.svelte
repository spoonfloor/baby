<!-- The gear button and its menu of settings. -->
<script lang="ts">
	import Menu from './Menu.svelte';
	import Row from './Row.svelte';

	interface Props {
		/** Baby is busy, so the model can’t be reset, saved, loaded, or undone. */
		busy?: boolean;
		/** There’s a training to undo. */
		undoable?: boolean;
		/** Reset model was chosen; the caller confirms before resetting. */
		onreset: () => void;
		/** Save or load model was chosen. */
		onsaves: () => void;
		/** Undo last training was chosen. */
		onundo: () => void;
		/** Copy transcript was chosen. */
		oncopytranscript: () => void;
	}

	let {
		busy = false,
		undoable = false,
		onreset,
		onsaves,
		onundo,
		oncopytranscript
	}: Props = $props();

	const rows = $derived([
		{ label: 'Reset model', disabled: busy, onclick: onreset },
		{ label: 'Save or load model', disabled: busy, onclick: onsaves },
		{ label: 'Undo last training', disabled: busy || !undoable, onclick: onundo },
		{ label: 'Copy transcript', disabled: false, onclick: oncopytranscript }
	]);
</script>

<Menu icon="gear" label="Settings" placement="above-end">
	{#snippet children(close)}
		<ul>
			{#each rows as row (row.label)}
				<li>
					<Row
						disabled={row.disabled}
						onclick={() => {
							close();
							row.onclick();
						}}
					>
						{row.label}
					</Row>
				</li>
			{/each}
		</ul>
	{/snippet}
</Menu>
