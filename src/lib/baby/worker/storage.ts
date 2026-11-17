import type { ModelSnapshot } from '../model.ts';

/**
 * Keeps Baby in IndexedDB, so it survives a reload: the current model, saved after
 * each change, and a checkpoint of the model from before the latest reading, for undo.
 * Each is kept with its revision (see `BabyState.revision`).
 */

const DATABASE = 'baby';
const STORE = 'snapshots';
/** Bump when ModelSnapshot changes shape, so older saves are set aside rather than misread. */
const FORMAT = 1;

/** Which model a record holds. `baby` is the current one (named before checkpoints existed). */
export type Slot = 'baby' | 'checkpoint';

export interface Kept {
	snapshot: ModelSnapshot;
	revision: string;
}

interface Saved {
	format: number;
	snapshot: ModelSnapshot;
	/** Missing from records written before revisions existed. */
	revision?: string;
}

let database: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
	database ??= new Promise((resolve, reject) => {
		const request = indexedDB.open(DATABASE, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('Couldn’t open storage'));
	});
	return database;
}

/** The model kept in `slot`, or undefined if there is none in the current format. */
export async function load(slot: Slot): Promise<Kept | undefined> {
	const request = (await open()).transaction(STORE).objectStore(STORE).get(slot);
	const saved = await new Promise<Saved | undefined>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result as Saved | undefined);
		request.onerror = () => reject(request.error ?? new Error('Couldn’t load Baby'));
	});
	if (saved?.format !== FORMAT) return undefined;
	return { snapshot: saved.snapshot, revision: saved.revision ?? crypto.randomUUID() };
}

/** Keeps `kept` in `slot`, resolving once it is safely written. */
export async function keep(slot: Slot, { snapshot, revision }: Kept): Promise<void> {
	const saved: Saved = { format: FORMAT, snapshot, revision };
	await write((store) => store.put(saved, slot));
}

/** Empties `slot`, resolving once it is. */
export async function clear(slot: Slot): Promise<void> {
	await write((store) => store.delete(slot));
}

async function write(change: (store: IDBObjectStore) => void): Promise<void> {
	const transaction = (await open()).transaction(STORE, 'readwrite');
	change(transaction.objectStore(STORE));
	await new Promise<void>((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error ?? new Error('Couldn’t write to storage'));
		transaction.onabort = () =>
			reject(transaction.error ?? new Error('Writing to storage was cancelled'));
	});
}
