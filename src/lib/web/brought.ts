import type { Document, ReadSource } from '#lib/baby/index.ts';

/** Starts the `source` of everything read from the web, followed by its address. */
export const WEB_SOURCE = 'web:';

/** Starts the `source` of an uploaded file, followed by a digest of its text. */
export const FILE_SOURCE = 'file:';

/** The sources panel group uploaded files are listed in. */
export const FILES_GROUP = 'Your files';

/**
 * Something the user brought for Baby to read, kept once and as it was then: a page
 * or a feed’s post from the web (with its `url`), or a file they uploaded (its name,
 * `file`).
 */
export type BroughtSource = {
	/** `web:` and its address, or `file:` and its text’s digest, so bringing it again is the same source. */
	id: string;
	title: string;
	/** Its group in the sources panel: the feed it came in, a page’s site, or Your files. */
	group: string;
	/** The exact tokens Baby trains on, a paragraph to each. */
	documents: Document[];
} & ({ url: string } | { file: string });

/** A page or a feed’s post, brought from the web. */
export type WebSource = BroughtSource & { url: string };

/** An uploaded file. */
export type FileSource = BroughtSource & { file: string };

/** Whether `id` is a source the user brought. */
export function isBrought(id: string): boolean {
	return id.startsWith(WEB_SOURCE) || id.startsWith(FILE_SOURCE);
}

/** The id of what was fetched from `url`. */
export function webSourceId(url: string): string {
	return `${WEB_SOURCE}${url}`;
}

/** The id of an uploaded file whose text is `text`: the same text, the same source. */
export async function fileSourceId(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0'));
	return `${FILE_SOURCE}${hex.join('').slice(0, 32)}`;
}

/** “example.com”: the site at `url`. */
export function siteOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}

/** Where a source came from, as its preview credits it: a page’s site, or a file’s name. */
export function creditOf(source: BroughtSource): string {
	return 'url' in source ? siteOf(source.url) : source.file;
}

/**
 * Sources the user brought that Baby has read, from what it kept of them. Baby doesn’t
 * keep which feed a page came in or a file’s name, so a page is grouped by its own site
 * and a file goes by its title: this only lists what was read on another device and
 * never brought on this one.
 */
export function readBroughtSources(sources: readonly ReadSource[]): BroughtSource[] {
	return sources.flatMap(({ id, title, documents }): BroughtSource[] => {
		if (title === undefined || !documents) return [];
		if (id.startsWith(WEB_SOURCE)) {
			const url = id.slice(WEB_SOURCE.length);
			return [{ id, url, title, group: siteOf(url), documents }];
		}
		if (id.startsWith(FILE_SOURCE)) {
			return [{ id, file: title, title, group: FILES_GROUP, documents }];
		}
		return [];
	});
}

/** Sources by group, groups in the order first seen, each source once. */
export function byGroup(
	sources: readonly BroughtSource[]
): { title: string; sources: BroughtSource[] }[] {
	const groups = new Map<string, BroughtSource[]>();
	const seen = new Set<string>();
	for (const source of sources) {
		if (seen.has(source.id)) continue;
		seen.add(source.id);
		groups.set(source.group, [...(groups.get(source.group) ?? []), source]);
	}
	return [...groups].map(([title, sources]) => ({ title, sources }));
}
