import type { WebSource } from './webSource.ts';

/** A fetched source and where it goes in the list. */
export interface Fetched {
	source: WebSource;
	/** When it was fetched, in milliseconds since 1970. */
	at: number;
	/** Its place among what was fetched with it, e.g. a post’s place in its feed. */
	index: number;
}

/** Somewhere to keep what was fetched; IndexedDB in the app. */
export interface FetchedStore {
	list(): Promise<Fetched[]>;
	put(fetched: readonly Fetched[]): Promise<void>;
}

/**
 * `added` (fetched together at `at`) joined to `existing`, newest fetch first. A source
 * already fetched keeps its first text and place, so refetching a feed only adds posts.
 */
export function addFetched(
	existing: readonly Fetched[],
	added: readonly WebSource[],
	at: number
): { all: Fetched[]; added: Fetched[] } {
	const known = new Set(existing.map(({ source }) => source.id));
	const fresh = added
		.filter(
			({ id }, index) => !known.has(id) && added.findIndex((other) => other.id === id) === index
		)
		.map((source, index) => ({ source, at, index }));
	return { all: inOrder([...existing, ...fresh]), added: fresh };
}

export function inOrder(fetched: Fetched[]): Fetched[] {
	return fetched.sort((a, b) => b.at - a.at || a.index - b.index);
}
