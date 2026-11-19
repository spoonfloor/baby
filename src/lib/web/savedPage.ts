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
	| 'type';

export class SavedPageError extends Error {
	readonly problem: SavedPageProblem;

	constructor(problem: SavedPageProblem, message: string) {
		super(message);
		this.problem = problem;
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

export async function savedPage(file: File, url: string): Promise<FetchedText> {
	return { url, ...(await savedFile(file)) };
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
