import { decode, type FetchedText } from './fetchThroughServer.ts';

/**
 * A page the user saved from their browser, for when a site refuses the save server
 * but not a person: read as if the server had fetched it from `url`, the address it
 * refused, so it becomes the same source.
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
	const extension = /\.([^.]+)$/.exec(file.name)?.[1]?.toLowerCase() ?? '';
	if (extension === 'webarchive') throw new SavedPageError('webarchive', 'A Safari web archive');
	const mediaType = file.type === 'text/html' || file.type === 'text/plain' ? file.type : undefined;
	const type = mediaType ?? BY_EXTENSION[extension];
	if (type === undefined) throw new SavedPageError('type', `Not a page: ${file.name}`);
	const bytes = await file.arrayBuffer();
	return { url, contentType: type, text: decode(bytes, `${type}; charset=${charsetOf(bytes)}`) };
}

/** The charset a saved page names in its `<meta>`, or UTF-8, which browsers save most pages in. */
function charsetOf(bytes: ArrayBuffer): string {
	const head = new TextDecoder('latin1').decode(bytes.slice(0, CHARSET_SCAN));
	return /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1] ?? 'utf-8';
}
