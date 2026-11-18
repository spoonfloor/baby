import type { Document, ReadSource } from '#lib/baby/index.ts';

/** Starts the `source` of everything read from the web, followed by its address. */
export const WEB_SOURCE = 'web:';

/** A page or a feed’s post, fetched once and kept as it was then. */
export interface WebSource {
	/** `web:` and its address, so reading it again is the same source. */
	id: string;
	url: string;
	title: string;
	/** Its group in the sources panel: the feed it came in, or the site of a page fetched alone. */
	group: string;
	/** The exact tokens Baby trains on, a paragraph to each. */
	documents: Document[];
}

/** The id of what was fetched from `url`. */
export function webSourceId(url: string): string {
	return `${WEB_SOURCE}${url}`;
}

/** “example.com”: the site at `url`. */
export function siteOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}

/**
 * Web sources Baby has read, from what it kept of them. Baby doesn’t keep which feed
 * one came in, so each is grouped by its own site: this only names the group of one
 * read on another device and never fetched on this one.
 */
export function readWebSources(sources: readonly ReadSource[]): WebSource[] {
	return sources.flatMap(({ id, title, documents }) => {
		if (!id.startsWith(WEB_SOURCE) || title === undefined || !documents) return [];
		const url = id.slice(WEB_SOURCE.length);
		return [{ id, url, title, group: siteOf(url), documents }];
	});
}

/** Sources by group, groups in the order first seen, each source once. */
export function byGroup(sources: readonly WebSource[]): { title: string; sources: WebSource[] }[] {
	const groups = new Map<string, WebSource[]>();
	const seen = new Set<string>();
	for (const source of sources) {
		if (seen.has(source.id)) continue;
		seen.add(source.id);
		groups.set(source.group, [...(groups.get(source.group) ?? []), source]);
	}
	return [...groups].map(([title, sources]) => ({ title, sources }));
}
