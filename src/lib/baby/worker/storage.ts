import type { ModelSnapshot } from '../model.ts';

/**
 * Keeps Baby in IndexedDB, so it survives a reload: one record holding the latest
 * snapshot, saved after each reading.
 */

const DATABASE = 'baby';
const STORE = 'snapshots';
const KEY = 'baby';
/** Bump when ModelSnapshot changes shape, so older saves are set aside rather than misread. */
const FORMAT = 1;

interface Saved {
	format: number;
	snapshot: ModelSnapshot;
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

/** The saved Baby, or undefined if there is none in the current format. */
export async function loadSnapshot(): Promise<ModelSnapshot | undefined> {
	const request = (await open()).transaction(STORE).objectStore(STORE).get(KEY);
	const saved = await new Promise<Saved | undefined>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result as Saved | undefined);
		request.onerror = () => reject(request.error ?? new Error('Couldn’t load Baby'));
	});
	return saved?.format === FORMAT ? saved.snapshot : undefined;
}

/** Saves `snapshot`, resolving once it is safely written. */
export async function saveSnapshot(snapshot: ModelSnapshot): Promise<void> {
	const transaction = (await open()).transaction(STORE, 'readwrite');
	const saved: Saved = { format: FORMAT, snapshot };
	transaction.objectStore(STORE).put(saved, KEY);
	await new Promise<void>((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error ?? new Error('Couldn’t save Baby'));
		transaction.onabort = () => reject(transaction.error ?? new Error('Saving Baby was cancelled'));
	});
}
