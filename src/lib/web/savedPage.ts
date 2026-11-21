import { siteOf } from './brought.ts';
import { decode, type FetchedText } from './fetchThroughServer.ts';

/**
 * A page the user got from their browser themselves, for when a site refuses the save
 * server but not a person: saved as a file, or (on a phone, where saving pages is
 * awkward) its text copied and pasted. Read as if the server had fetched it from
 * `url`, the address it refused, so it becomes the same source.
 */

export type SavedPageProblem =
	/** Safari’s default, a binary format; its Page Source format is plain HTML. */
	| 'webarchive'
	/** Anything else that isn’t HTML or plain text. */
	| 'type'
	/** A page saved from another site than the one that refused (see `site`). */
	| 'elsewhere';

export class SavedPageError extends Error {
	readonly problem: SavedPageProblem;
	/** For `elsewhere`: the site the file was saved from, and the site of the page it was to be. */
	readonly sites: { file: string; page: string } | undefined;

	constructor(problem: SavedPageProblem, message: string, sites?: { file: string; page: string }) {
		super(message);
		this.problem = problem;
		this.sites = sites;
	}
}

/** What the file picker offers: saved pages and text, and Safari’s web archives, to explain them. */
export const SAVED_PAGE_ACCEPT = '.html,.htm,.xhtml,.txt,.webarchive,text/html,text/plain';

const BY_EXTENSION: Record<string, string> = {
	html: 'text/html',
	htm: 'text/html',
	xhtml: 'text/html',
	txt: 'text/plain'
};

/** How far into a page its `<meta charset>` must be, as browsers look for it. */
const CHARSET_SCAN = 1024;

/**
 * `file` as the page at `url`, or a SavedPageError. A page that says it came from
 * another site is the wrong file: it would be read as if `url` had sent it.
 */
export async function savedPage(file: File, url: string): Promise<FetchedText> {
	const saved = await savedFile(file);
	const from = saved.contentType === 'text/html' ? addressOf(saved.text, url) : undefined;
	const sites = from === undefined ? undefined : { file: siteOf(from), page: siteOf(url) };
	if (sites && !sameSite(sites.file, sites.page)) {
		throw new SavedPageError('elsewhere', `Saved from ${from}`, sites);
	}
	return { url, ...saved };
}

/**
 * Where a saved page says it came from: the address Chrome and Edge note when they
 * save it, else the page’s canonical address, else its Open Graph one. Undefined if
 * it names none, as Safari’s Page Source and Firefox’s saves often don’t.
 */
export function addressOf(html: string, url: string): string | undefined {
	const savedFrom = /<!--\s*saved from url=\(\d+\)(\S+?)\s*-->/i.exec(html)?.[1];
	const page = new DOMParser().parseFromString(html, 'text/html');
	const named = [
		savedFrom,
		page.querySelector('link[rel~=canonical][href]')?.getAttribute('href'),
		[...page.querySelectorAll('meta[property]')]
			.find((meta) => meta.getAttribute('property') === 'og:url')
			?.getAttribute('content')
	];
	for (const address of named) {
		if (!address?.trim()) continue;
		try {
			const resolved = new URL(address.trim(), url);
			if (resolved.protocol === 'https:' || resolved.protocol === 'http:') return resolved.href;
		} catch {
			// Not an address; try the next.
		}
	}
	return undefined;
}

/** One site is the other or a part of it, as m.example.com is of example.com. */
function sameSite(a: string, b: string): boolean {
	return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

/** A saved page’s or a text file’s text and type, or a SavedPageError if it’s neither. */
export async function savedFile(file: File): Promise<{ contentType: string; text: string }> {
	const extension = /\.([^.]+)$/.exec(file.name)?.[1]?.toLowerCase() ?? '';
	if (extension === 'webarchive') throw new SavedPageError('webarchive', 'A Safari web archive');
	const mediaType = file.type === 'text/html' || file.type === 'text/plain' ? file.type : undefined;
	const type = mediaType ?? BY_EXTENSION[extension];
	if (type === undefined) throw new SavedPageError('type', `Not a page: ${file.name}`);
	const bytes = await file.arrayBuffer();
	return { contentType: type, text: decode(bytes, `${type}; charset=${charsetOf(bytes)}`) };
}

/** The charset a saved page names in its `<meta>`, or UTF-8, which browsers save most pages in. */
function charsetOf(bytes: ArrayBuffer): string {
	const head = new TextDecoder('latin1').decode(bytes.slice(0, CHARSET_SCAN));
	return /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1] ?? 'utf-8';
}

/** What was pasted: its plain text, and the HTML it was copied as, when a paste carried it. */
export interface Pasted {
	text: string;
	html?: string | undefined;
}

/**
 * Pasted text as a page: its HTML when the paste carried it, so paragraphs come from
 * the page’s own markup; otherwise its plain text, where a copied page puts each
 * paragraph on a line of its own.
 */
export function pastedPage({ text, html }: Pasted, url: string): FetchedText {
	if (html !== undefined && html.trim() !== '')
		return { url, contentType: 'text/html', text: html };
	return { url, contentType: 'text/plain', text: text.split(/\n+/).join('\n\n') };
}
