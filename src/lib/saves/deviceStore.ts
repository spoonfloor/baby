import {
	meets,
	newestFirst,
	StoreError,
	type Expected,
	type SaveInfo,
	type SaveStore,
	type StoredSave
} from './store.ts';

/**
 * Saves kept in this browser’s IndexedDB: each save’s information in one store, its
 * file in another, so listing never reads the files.
 */

const DATABASE = 'baby-saves';
const INFO = 'info';
const FILES = 'files';

let database: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
	database ??= new Promise((resolve, reject) => {
		const request = indexedDB.open(DATABASE, 1);
		request.onupgradeneeded = () => {
			request.result.createObjectStore(INFO);
			request.result.createObjectStore(FILES);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('Couldn’t open saves'));
	});
	return database;
}

function result<T>(request: IDBRequest): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result as T);
		request.onerror = () => reject(request.error ?? new Error('Couldn’t read saves'));
	});
}

/** Runs `change` in one transaction over both stores, resolving once it’s written. */
async function transact<T>(change: (info: IDBObjectStore, files: IDBObjectStore) => Promise<T>) {
	const transaction = (await open()).transaction([INFO, FILES], 'readwrite');
	const done = new Promise<void>((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error ?? new Error('Couldn’t write saves'));
		transaction.onabort = () => reject(transaction.error ?? new Error('Saving was cancelled'));
	});
	try {
		const value = await change(transaction.objectStore(INFO), transaction.objectStore(FILES));
		await done;
		return value;
	} catch (error) {
		if (transaction.error === null) transaction.abort();
		await done.catch(() => {});
		throw error;
	}
}

function conflict(): StoreError {
	return new StoreError('conflict', 'The save changed since it was last read');
}

export const deviceStore: SaveStore = {
	async list() {
		const store = (await open()).transaction(INFO).objectStore(INFO);
		return newestFirst(await result<StoredSave[]>(store.getAll()));
	},

	async read(id) {
		const transaction = (await open()).transaction([INFO, FILES]);
		const [info, bytes] = await Promise.all([
			result<StoredSave | undefined>(transaction.objectStore(INFO).get(id)),
			result<Uint8Array<ArrayBuffer> | undefined>(transaction.objectStore(FILES).get(id))
		]);
		if (!info || !bytes) throw new StoreError('missing', 'That save is gone');
		return { bytes, version: info.version };
	},

	write(info: SaveInfo, bytes: Uint8Array<ArrayBuffer>, expected: Expected) {
		return transact(async (infos, files) => {
			const found = await result<StoredSave | undefined>(infos.get(info.id));
			if (!meets(expected, found?.version)) throw conflict();
			const stored: StoredSave = { ...info, version: (found?.version ?? 0) + 1 };
			infos.put(stored, info.id);
			files.put(bytes, info.id);
			return stored;
		});
	},

	rename(id, name, expected) {
		return transact(async (infos) => {
			const found = await result<StoredSave | undefined>(infos.get(id));
			if (!found) throw new StoreError('missing', 'That save is gone');
			if (!meets(expected, found.version)) throw conflict();
			const stored: StoredSave = { ...found, name, version: found.version + 1 };
			infos.put(stored, id);
			return stored;
		});
	},

	async remove(id) {
		await transact(async (infos, files) => {
			infos.delete(id);
			files.delete(id);
		});
	}
};
