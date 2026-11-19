import type { BroughtSource } from './brought.ts';

/** A fetched source and where it goes in the list. */
export interface Fetched {
	source: BroughtSource;
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
 * `added` (fetched together at `at`) joined to `existing`, newest fetch first, and
 * the entries that changed, to keep. A source already fetched keeps its place and
 * group, and its first text: refetching a feed only adds posts, and never trades an
 * article for its teaser. Unless `replacing`, for a page read on its own, which is
 * the whole page: then its text and title replace a feed’s teaser of it.
 */
export function addFetched(
	existing: readonly Fetched[],
	added: readonly BroughtSource[],
	at: number,
	{ replacing = false }: { replacing?: boolean } = {}
): { all: Fetched[]; changed: Fetched[] } {
	const unique = added.filter(
		({ id }, index) => added.findIndex((other) => other.id === id) === index
	);
	const byId = new Map(unique.map((source) => [source.id, source]));
	const known = new Set(existing.map(({ source }) => source.id));
	const replaced = replacing
		? existing.flatMap((entry) => {
				const page = byId.get(entry.source.id);
				return page ? [{ ...entry, source: { ...page, group: entry.source.group } }] : [];
			})
		: [];
	const fresh = unique
		.filter(({ id }) => !known.has(id))
		.map((source, index) => ({ source, at, index }));
	const kept = existing.map(
		(entry) => replaced.find(({ source }) => source.id === entry.source.id) ?? entry
	);
	return { all: inOrder([...kept, ...fresh]), changed: [...replaced, ...fresh] };
}

export function inOrder(fetched: Fetched[]): Fetched[] {
	return fetched.sort((a, b) => b.at - a.at || a.index - b.index);
}

/**
 * Ids of what arrived in a group after the group was first brought: a feed’s posts
 * since it was first read from its address, or files uploaded since the first.
 */
export function laterArrivals(fetched: readonly Fetched[]): Set<string> {
	const first = new Map<string, number>();
	for (const { source, at } of fetched) {
		first.set(source.group, Math.min(at, first.get(source.group) ?? at));
	}
	return new Set(
		fetched
			.filter(({ source, at }) => at > (first.get(source.group) ?? at))
			.map(({ source }) => source.id)
	);
}
