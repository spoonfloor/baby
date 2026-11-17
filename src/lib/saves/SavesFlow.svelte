<!--
	Saving and loading the model, from the Saves dialog: the dialogs it opens (naming
	a save, connecting a server, confirmations) and what each action does, deleting
	several saves at once included.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import ConfirmDialog from '#lib/ui/ConfirmDialog.svelte';
	import ConnectDialog from '#lib/ui/ConnectDialog.svelte';
	import SaveNameDialog from '#lib/ui/SaveNameDialog.svelte';
	import SavesDialog from '#lib/ui/SavesDialog.svelte';
	import { count } from '#lib/baby/reading.ts';
	import { describeSave, problemText } from './describe.ts';
	import type { Saves } from './saves.svelte.ts';
	import { StoreError, type Place, type SaveKey, type StoredSave } from './store.ts';

	interface Props {
		saves: Saves;
		/** A name for a new save: what the model read last. */
		defaultName: string;
		onclose: () => void;
	}

	let { saves, defaultName, onclose }: Props = $props();

	const PLACES = { device: 'this device', server: 'the server' } as const;
	/** Where a save is kept, as a label after its name. */
	const PLACE_LABELS = { device: 'this device', server: 'server' } as const;
	const STANDING = {
		untrained: 'The current model hasn’t trained on anything yet.',
		unsaved: 'The current model has training that isn’t saved.',
		saved: 'The current model is saved.'
	} as const;

	/** The save whose actions are showing. */
	let picked: SaveKey | undefined = $state();
	/** In select mode, the saves checked so far; undefined otherwise. */
	let checked: SaveKey[] | undefined = $state();
	let working: string | undefined = $state();
	let problem: string | undefined = $state();

	/** Naming a new save, or renaming one. */
	let naming:
		| { mode: 'save'; name: string; place: Place }
		| { mode: 'rename'; name: string; place: Place; id: string }
		| undefined = $state();
	let connecting: { address: string; token: string } | undefined = $state();
	let confirming:
		| { kind: 'load'; save: StoredSave; place: Place }
		| { kind: 'delete'; saves: Found[] }
		| { kind: 'conflict'; name: string; place: Place }
		| undefined = $state();

	const host = $derived(saves.connection && new URL(saves.connection.address).host);
	const rows = (list: StoredSave[]) =>
		list.map((save) => ({ id: save.id, name: save.name, meta: describeSave(save) }));
	const existing = $derived(naming && saves.named(naming.place, naming.name));

	onMount(() => {
		run('Loading saves', () => saves.refresh());
	});

	/** Runs `work`, saying it’s under way, and what went wrong if it fails. True if it worked. */
	async function run(
		doing: string,
		work: () => Promise<unknown>,
		fallback?: string
	): Promise<boolean> {
		working = doing;
		problem = undefined;
		try {
			await work();
			return true;
		} catch (error) {
			console.error(error);
			problem = problemText(error, fallback);
			return false;
		} finally {
			working = undefined;
		}
	}

	/** A save as listed, and where it’s kept. */
	type Found = StoredSave & { place: Place };

	function find({ place, id }: SaveKey): Found | undefined {
		const save = (place === 'device' ? saves.device : saves.server).find((s) => s.id === id);
		return save && { ...save, place };
	}

	const same = (a: SaveKey | undefined, b: SaveKey) => a?.place === b.place && a.id === b.id;

	function pick(key: SaveKey) {
		problem = undefined;
		picked = same(picked, key) ? undefined : key;
	}

	function check(key: SaveKey) {
		if (!checked) return;
		problem = undefined;
		checked = checked.some((other) => same(other, key))
			? checked.filter((other) => !same(other, key))
			: [...checked, key];
	}

	function startSaving() {
		problem = undefined;
		naming = { mode: 'save', name: defaultName, place: saves.connection ? 'server' : 'device' };
	}

	/**
	 * Saves from the conflict prompt, replacing the save that changed or as a new one
	 * beside it; a failure shows in the Saves dialog. Takes what it needs as arguments:
	 * closing the prompt clears `confirming`.
	 */
	function resolveConflict(name: string, place: Place, how: 'replace' | 'new') {
		confirming = undefined;
		const as = how === 'new' ? saves.unusedName(place, name) : name;
		void run(`Saving “${as.trim()}”`, () => saves.save(as, place, { force: how === 'replace' }));
	}

	async function confirmNaming() {
		if (!naming) return;
		const { name, place } = naming;
		if (naming.mode === 'rename') {
			const { id } = naming;
			if (await run(`Renaming to “${name.trim()}”`, () => saves.rename(place, id, name))) {
				naming = undefined;
			}
			return;
		}
		try {
			working = `Saving “${name.trim()}”`;
			problem = undefined;
			await saves.save(name, place);
			naming = undefined;
			picked = undefined;
		} catch (error) {
			if (error instanceof StoreError && error.kind === 'conflict') {
				naming = undefined;
				confirming = { kind: 'conflict', name, place };
			} else {
				console.error(error);
				problem = problemText(error);
			}
		} finally {
			working = undefined;
		}
	}

	function load(key: SaveKey) {
		const target = find(key);
		if (!target) return;
		if (saves.unsaved) confirming = { kind: 'load', save: target, place: key.place };
		else void loadNow(target, key.place);
	}

	async function loadNow(target: StoredSave, place: Place) {
		confirming = undefined;
		const loaded = await run(
			`Loading “${target.name}”`,
			() => saves.load(place, target.id),
			'Couldn’t load this save. It may be from a different version of the app.'
		);
		if (loaded) onclose();
	}

	function rename(key: SaveKey) {
		const target = find(key);
		if (target) naming = { mode: 'rename', name: target.name, ...key };
	}

	function move({ place, id }: SaveKey) {
		const target = find({ place, id });
		if (!target) return;
		const to: Place = place === 'device' ? 'server' : 'device';
		void run(`Moving “${target.name}” to ${PLACES[to]}`, async () => {
			await saves.move(place, id);
			picked = { place: to, id };
		});
	}

	/** Asks before deleting `keys`: one save from its actions, or the ones checked. */
	function askToRemove(keys: readonly SaveKey[]) {
		const found = keys.flatMap((key) => find(key) ?? []);
		if (found.length > 0) confirming = { kind: 'delete', saves: found };
	}

	/**
	 * Deletes `targets`. Any that couldn’t be deleted stay checked (in select mode),
	 * and the problem line says how many went and why the rest didn’t.
	 */
	async function removeNow(targets: Found[]) {
		confirming = undefined;
		picked = undefined;
		const [only] = targets;
		working =
			targets.length === 1 && only
				? `Deleting “${only.name}”`
				: `Deleting ${count(targets.length, 'save')}`;
		problem = undefined;
		try {
			const { failed, error } = await saves.remove(targets);
			if (failed.length === 0) {
				checked = undefined;
				return;
			}
			if (checked) checked = failed;
			const went = targets.length - failed.length;
			problem =
				targets.length === 1
					? problemText(error)
					: `Deleted ${went} of ${targets.length}. ${problemText(error)}`;
		} catch (error) {
			console.error(error);
			problem = problemText(error);
		} finally {
			working = undefined;
		}
	}

	async function connect() {
		if (!connecting) return;
		const { address, token } = connecting;
		if (await run('Connecting', () => saves.connect(address, token))) connecting = undefined;
	}

	function disconnect() {
		if (picked?.place === 'server') picked = undefined;
		saves.disconnect();
	}
</script>

<SavesDialog
	status={STANDING[saves.standing]}
	device={rows(saves.device)}
	server={host ? { host, saves: rows(saves.server), problem: saves.serverProblem } : undefined}
	{picked}
	{checked}
	working={naming || connecting ? undefined : working}
	problem={naming || connecting ? undefined : problem}
	onpick={pick}
	onload={load}
	onrename={rename}
	onmove={move}
	ondelete={(key) => askToRemove([key])}
	onselect={() => {
		problem = undefined;
		picked = undefined;
		checked = [];
	}}
	oncheck={check}
	ondeletechecked={() => askToRemove(checked ?? [])}
	onstopselecting={() => {
		problem = undefined;
		checked = undefined;
	}}
	onsave={startSaving}
	onconnect={() => {
		problem = undefined;
		connecting = { address: saves.connection?.address ?? '', token: '' };
	}}
	ondisconnect={disconnect}
	{onclose}
/>

{#if naming}
	{@const place = PLACES[naming.place]}
	<SaveNameDialog
		title={naming.mode === 'save' ? 'Save current model' : 'Rename save'}
		note={naming.mode === 'rename'
			? `Renames the save on ${place}.`
			: existing
				? `Replaces the save named “${existing.name}” on ${place}.`
				: `Saves the model as it is now to ${place}, to load again later.`}
		confirm={naming.mode === 'rename' ? 'Rename' : existing ? 'Replace' : 'Save'}
		bind:name={naming.name}
		places={naming.mode === 'save' && saves.connection
			? [
					{ value: 'device', label: 'This device' },
					{ value: 'server', label: 'Server' }
				]
			: undefined}
		bind:place={naming.place}
		{working}
		{problem}
		onconfirm={confirmNaming}
		onclose={() => {
			naming = undefined;
			problem = undefined;
		}}
	/>
{/if}

{#if connecting}
	<ConnectDialog
		bind:address={connecting.address}
		bind:token={connecting.token}
		{working}
		{problem}
		onconnect={connect}
		onclose={() => {
			connecting = undefined;
			problem = undefined;
		}}
	/>
{/if}

{#if confirming?.kind === 'load'}
	{@const { save: target, place } = confirming}
	<ConfirmDialog
		title="Replace the current model?"
		description={`It has training that isn’t saved, which loading “${target.name}” will lose.`}
		confirm="Load anyway"
		onconfirm={() => loadNow(target, place)}
		onclose={() => (confirming = undefined)}
	/>
{:else if confirming?.kind === 'delete'}
	{@const targets = confirming.saves}
	{@const [only] = targets}
	<ConfirmDialog
		title={targets.length === 1 && only
			? `Delete “${only.name}”?`
			: `Delete ${count(targets.length, 'save')}?`}
		confirm="Delete forever"
		items={targets.length > 1
			? targets.map((target) => ({
					key: `${target.place}:${target.id}`,
					label: target.name,
					note: PLACE_LABELS[target.place]
				}))
			: undefined}
		onconfirm={() => removeNow(targets)}
		onclose={() => (confirming = undefined)}
	/>
{:else if confirming?.kind === 'conflict'}
	{@const { name, place } = confirming}
	<ConfirmDialog
		title="Changed on another device"
		description={`“${name.trim()}” was saved from another device after you last loaded or saved it. Saving here would replace that version.`}
		confirm="Save as new"
		alternative={{ label: 'Replace', onclick: () => resolveConflict(name, place, 'replace') }}
		onconfirm={() => resolveConflict(name, place, 'new')}
		onclose={() => (confirming = undefined)}
	/>
{/if}
