import { addFetched, inOrder, type Fetched, type FetchedStore } from './fetched.ts';
import type { BroughtSource } from './brought.ts';

/**
 * Pages and posts fetched and files uploaded on this device, kept as they were then so
 * reading one again reads the same text. Baby keeps its own copy of whatever it reads (so
 * that travels with saves); this is what was brought and not necessarily read, like
 * the rest of a feed.
 */

/** What was brought on this device, newest first, for the sources panel. */
export class BroughtSources {
	sources: BroughtSource[] = $state.raw([]);
	#all: Fetched[] = [];
	#store: FetchedStore;

	constructor(store: FetchedStore) {
		this.#store = store;
	}

	async load() {
		this.#all = inOrder(await this.#store.list());
		this.sources = this.#all.map(({ source }) => source);
	}

	/**
	 * Keeps `sources`, brought together just now. `replacing` for a page read on its
	 * own, whose whole text replaces a feed’s teaser of it (see `addFetched`).
	 */
	async add(sources: readonly BroughtSource[], options?: { replacing?: boolean }) {
		const { all, changed } = addFetched(this.#all, sources, Date.now(), options);
		this.#all = all;
		this.sources = all.map(({ source }) => source);
		await this.#store.put(changed);
	}
}

const DATABASE = 'baby-web';
const FETCHED = 'fetched';

let database: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
	database ??= new Promise((resolve, reject) => {
		const request = indexedDB.open(DATABASE, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(FETCHED);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('Couldn’t open fetched pages'));
	});
	return database;
}

/** Fetched sources in this browser’s IndexedDB, keyed by id. */
export const deviceFetchedStore: FetchedStore = {
	async list() {
		const store = (await open()).transaction(FETCHED).objectStore(FETCHED);
		return new Promise((resolve, reject) => {
			const request = store.getAll();
			request.onsuccess = () => resolve(request.result as Fetched[]);
			request.onerror = () => reject(request.error ?? new Error('Couldn’t read fetched pages'));
		});
	},

	async put(fetched) {
		const transaction = (await open()).transaction(FETCHED, 'readwrite');
		const store = transaction.objectStore(FETCHED);
		for (const entry of fetched) store.put(entry, entry.source.id);
		await new Promise<void>((resolve, reject) => {
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error ?? new Error('Couldn’t keep pages'));
			transaction.onabort = () => reject(transaction.error ?? new Error('Couldn’t keep pages'));
		});
	}
};
