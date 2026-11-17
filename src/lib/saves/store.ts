/**
 * Where saved models are kept. A store holds `.baby` files (see saveFile.ts), each
 * with a little information to list it by. This device and a server are both stores,
 * behind this one interface, so everything above it works the same for both.
 */

/** Where a save is kept. */
export type Place = 'device' | 'server';

/** One save, by where it’s kept and its id there. */
export interface SaveKey {
	place: Place;
	id: string;
}

/** What a save is, without its file: enough to list it. */
export interface SaveInfo {
	id: string;
	name: string;
	/** When it was saved, as an ISO date. */
	savedAt: string;
	/** Words and sources the saved model has read, as `BabyState` counts them. */
	words: number;
	sources: number;
}

/** A save as a store keeps it: `version` goes up by one with every change to it. */
export interface StoredSave extends SaveInfo {
	version: number;
}

/**
 * What a write expects to find: no save with that id yet, the save at `version`
 * (so a change made elsewhere since isn’t lost), or any save at all (replace regardless).
 */
export type Expected = 'new' | 'any' | { version: number };

export interface SaveStore {
	/** Every save, newest first. */
	list(): Promise<StoredSave[]>;
	read(id: string): Promise<{ bytes: Uint8Array<ArrayBuffer>; version: number }>;
	/** Writes `bytes` as the save `info.id`, returning it as stored. */
	write(info: SaveInfo, bytes: Uint8Array<ArrayBuffer>, expected: Expected): Promise<StoredSave>;
	rename(id: string, name: string, expected: Expected): Promise<StoredSave>;
	remove(id: string): Promise<void>;
}

/**
 * Why saving refused: someone else changed the save first, the name is taken, or the
 * store couldn’t be used.
 */
export class StoreError extends Error {
	override name = 'StoreError';
	readonly kind:
		'conflict' | 'missing' | 'unauthorized' | 'unreachable' | 'taken' | 'address' | 'failed';

	constructor(kind: StoreError['kind'], message: string) {
		super(message);
		this.kind = kind;
	}
}

/** Whether `expected` allows a write over `found` (the save’s current version, if any). */
export function meets(expected: Expected, found: number | undefined): boolean {
	if (expected === 'new') return found === undefined;
	if (expected === 'any') return found !== undefined;
	return found === expected.version;
}

export function newestFirst(saves: StoredSave[]): StoredSave[] {
	return saves.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
