import { Readability } from '@mozilla/readability';
import type { FetchedText } from './fetchThroughServer.ts';
import { siteOf, webSourceId, type WebSource } from './brought.ts';
import { broughtDocuments } from './sentences.ts';

/**
 * Turns what a site sent into what Baby reads: a page becomes its article text, the
 * way a browser’s reader view finds it; a feed becomes its posts, each a source of
 * its own. Runs in the browser (it needs DOMParser), so the server only fetches.
 */

export type Extracted =
	| {
			kind: 'page';
			source: WebSource;
			/** The feed this page offers in its place, if it’s a site’s or section’s front page. */
			feed?: string;
	  }
	| { kind: 'feed'; title: string; sources: WebSource[] };

const CONTENT_NS = 'http://purl.org/rss/1.0/modules/content/';

const FEED_TYPES = new Set(['application/rss+xml', 'application/atom+xml']);

/** Elements that each hold a paragraph’s worth of text. */
const BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, figcaption, dt, dd';

/**
 * What isn’t prose: code, tables (an infobox’s cells would read as one-word
 * paragraphs), and footnote marks like “[1]”.
 */
const NOT_PROSE = 'script, style, noscript, template, table, sup:has(a)';

export function extract({ url, contentType, text }: FetchedText): Extracted {
	const mediaType = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
	if (mediaType === 'text/plain') {
		return { kind: 'page', source: webSource(url, url, siteOf(url), plainParagraphs(text)) };
	}
	if (mediaType !== 'text/html' && looksLikeXml(text)) {
		const feed = parseFeed(text, url);
		if (feed) return { kind: 'feed', ...feed };
	}
	return { kind: 'page', ...parsePage(text, url) };
}

function looksLikeXml(text: string): boolean {
	return /^\s*(<\?xml|<rss|<feed|<rdf:RDF)/i.test(text);
}

function parsePage(html: string, url: string): { source: WebSource; feed?: string } {
	const { title, paragraphs, feed } = readPage(html, url);
	const source = webSource(url, title || url, siteOf(url), paragraphs);
	return feed === undefined ? { source } : { source, feed };
}

/**
 * A page’s article, the way a browser’s reader view finds it: its title (empty if it
 * has none), its paragraphs, and the feed it offers. Links resolve against `url`, the
 * page’s address, when it has one; an uploaded page has none.
 */
export function readPage(
	html: string,
	url?: string
): { title: string; paragraphs: string[]; feed?: string } {
	const page = new DOMParser().parseFromString(html, 'text/html');
	if (url !== undefined) {
		const base = page.createElement('base');
		base.href = url;
		page.head.prepend(base);
	}
	const fallbackTitle = clean(page.title);
	const feed = url === undefined ? undefined : offeredFeed(page);
	const article = new Readability(page).parse();
	const paragraphs = articleParagraphs(
		article?.content || page.body.innerHTML,
		clean(article?.byline ?? '')
	);
	const title = clean(article?.title ?? '') || fallbackTitle;
	return feed === undefined ? { title, paragraphs } : { title, paragraphs, feed };
}

/**
 * The RSS or Atom feed a page links as its alternate, unless the page is a single
 * post: a post’s page links its whole site’s feed too, and reading that instead
 * would drop the post that was asked for. A page is a post when its Open Graph type
 * is anything but “website”, which sites set for their front and section pages.
 */
function offeredFeed(page: Document): string | undefined {
	const type = [...page.querySelectorAll('meta[property]')]
		.find((meta) => meta.getAttribute('property') === 'og:type')
		?.getAttribute('content')
		?.trim()
		.toLowerCase();
	if (type !== undefined && type !== 'website') return undefined;
	const link = [...page.querySelectorAll<HTMLLinkElement>('link[rel~=alternate][href]')].find(
		(element) => FEED_TYPES.has(element.type.trim().toLowerCase())
	);
	// Resolved against the page’s address by the <base> above.
	return link?.href || undefined;
}

/** An RSS or Atom feed’s posts, newest first as feeds list them; undefined if it isn’t a feed. */
function parseFeed(xml: string, url: string): { title: string; sources: WebSource[] } | undefined {
	const feed = new DOMParser().parseFromString(xml, 'application/xml');
	if (feed.querySelector('parsererror')) return undefined;
	const root = feed.documentElement;
	const atom = root.localName === 'feed';
	if (!atom && root.localName !== 'rss' && root.localName !== 'RDF') return undefined;

	const title =
		clean(child(atom ? root : (child(root, 'channel') ?? root), 'title')?.textContent) ||
		siteOf(url);
	const entries = [...root.getElementsByTagName(atom ? 'entry' : 'item')];
	const sources = entries.flatMap((entry) => {
		const link = atom ? atomLink(entry) : (child(entry, 'link')?.textContent ?? guidLink(entry));
		if (!link) return [];
		let address: string;
		try {
			address = new URL(link.trim(), url).href;
		} catch {
			return [];
		}
		const paragraphs = atom ? atomParagraphs(entry) : rssParagraphs(entry);
		const source = webSource(
			address,
			clean(child(entry, 'title')?.textContent) || address,
			title,
			paragraphs
		);
		return source.documents.length > 0 ? [source] : [];
	});
	return { title, sources };
}

function rssParagraphs(item: Element): string[] {
	const encoded = item.getElementsByTagNameNS(CONTENT_NS, 'encoded')[0];
	const html = encoded?.textContent || child(item, 'description')?.textContent || '';
	return htmlParagraphs(html);
}

function atomParagraphs(entry: Element): string[] {
	const content = child(entry, 'content') ?? child(entry, 'summary');
	if (!content) return [];
	switch (content.getAttribute('type')) {
		case 'xhtml':
			return htmlParagraphs(content.innerHTML);
		case 'html':
			return htmlParagraphs(content.textContent ?? '');
		default:
			return plainParagraphs(content.textContent ?? '');
	}
}

function atomLink(entry: Element): string | undefined {
	const links = [...entry.children].filter((element) => element.localName === 'link');
	const alternate =
		links.find((link) => link.getAttribute('rel') === 'alternate') ??
		links.find((link) => !link.hasAttribute('rel'));
	return alternate?.getAttribute('href') ?? undefined;
}

function guidLink(item: Element): string | undefined {
	const guid = child(item, 'guid')?.textContent?.trim();
	return guid && /^https?:\/\//.test(guid) ? guid : undefined;
}

/** The first child element named `name`, ignoring namespaces. */
function child(parent: Element, name: string): Element | undefined {
	return [...parent.children].find((element) => element.localName === name);
}

/**
 * The text of `html`, a paragraph to each block: the innermost blocks, so a list
 * item holding a paragraph counts once. Text outside any block, as in a summary
 * with no markup, is read as plain text.
 */
export function htmlParagraphs(html: string): string[] {
	const body = proseBody(html);
	const blocks = proseBlocks(body);
	if (blocks.length === 0) return plainParagraphs(body.textContent ?? '');
	return blockTexts(blocks);
}

/**
 * An article’s paragraphs, as `htmlParagraphs`, without what reader view leaves
 * around the writing on many sites: photos with their captions and credits, a
 * dateline (“Published <time>…</time>”), the `byline` on a line of its own, promos
 * that are only a link (“Stay up to date with our newsletter”), and whatever trails
 * the last sentence (“Related articles”, “You may also be interested in:” and its
 * links). An article with no sentences at all, like a list, keeps every line.
 */
function articleParagraphs(html: string, byline: string): string[] {
	const body = proseBody(html);
	for (const figure of body.querySelectorAll('figure')) figure.remove();
	const blocks = proseBlocks(body).filter((block) => {
		const text = clean(block.textContent);
		return (
			text !== '' &&
			!isDateline(block) &&
			!isByline(text, byline) &&
			!isCaption(block) &&
			!isLinkOnly(block, text)
		);
	});
	const last = blocks.findLastIndex(isSentence);
	const writing = last === -1 ? blocks : blocks.slice(0, last + 1);
	if (writing.length === 0) return plainParagraphs(body.textContent ?? '');
	return blockTexts(writing);
}

const HEADINGS = 'h1, h2, h3, h4, h5, h6';

/** A paragraph of writing: not a heading, and ending as a sentence does, maybe inside quotes. */
function isSentence(block: Element): boolean {
	return !block.matches(HEADINGS) && /[.!?…]["”’)]*$/.test(clean(block.textContent));
}

/** A photo’s caption or credit outside a `<figure>`, marked by a credit’s label. */
function isCaption(block: Element): boolean {
	return [...block.querySelectorAll('[aria-label]')].some((element) =>
		/credit/i.test(element.getAttribute('aria-label') ?? '')
	);
}

/** A block whose words are all a link’s: a promo or a pointer elsewhere, not writing. */
function isLinkOnly(block: Element, text: string): boolean {
	const links = [...block.querySelectorAll('a')].map((link) => clean(link.textContent)).join(' ');
	return links !== '' && clean(links) === text;
}

/** At most this many words around a `<time>` make a block a dateline: “Last updated”. */
const DATELINE_WORDS = 2;

/** A block that’s a date and a word or two of label, not a sentence about a date. */
function isDateline(block: Element): boolean {
	if (!block.querySelector('time')) return false;
	const label = block.cloneNode(true) as Element;
	for (const time of label.querySelectorAll('time')) time.remove();
	const words = clean(label.textContent)
		.split(' ')
		.filter((word) => /\w/.test(word));
	return words.length <= DATELINE_WORDS;
}

/** A block that’s only the byline: “Pat Writer”, or “By Pat Writer”. */
function isByline(text: string, byline: string): boolean {
	if (byline === '') return false;
	const name = text.replace(/^by\s+/i, '').toLowerCase();
	return name === byline.replace(/^by\s+/i, '').toLowerCase();
}

function proseBody(html: string): HTMLElement {
	const body = new DOMParser().parseFromString(html, 'text/html').body;
	for (const element of body.querySelectorAll(NOT_PROSE)) element.remove();
	return body;
}

function proseBlocks(body: HTMLElement): Element[] {
	return [...body.querySelectorAll(BLOCKS)].filter((block) => !block.querySelector(BLOCKS));
}

function blockTexts(blocks: readonly Element[]): string[] {
	return blocks.map((block) => clean(block.textContent)).filter((text) => text !== '');
}

/**
 * Plain text, a paragraph between blank lines, with lines that hard-wrap a paragraph
 * joined back up. Leaves out what a printed page puts between them: page numbers
 * (“12”, “Page 3 of 10”) and running heads, a short line repeated page after page.
 */
export function plainParagraphs(text: string): string[] {
	const lines = text.split('\n');
	const counts = new Map<string, number>();
	for (const line of lines) {
		const key = clean(line);
		if (key !== '') counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	const isRunningHead = (line: string) =>
		(counts.get(line) ?? 0) >= RUNNING_HEAD_REPEATS && line.split(' ').length <= RUNNING_HEAD_WORDS;
	return lines
		.map((line) => {
			const text = clean(line);
			return PAGE_NUMBER.test(text) || isRunningHead(text) ? '' : line;
		})
		.join('\n')
		.split(/\n\s*\n/)
		.map(clean)
		.filter((paragraph) => paragraph !== '');
}

/** A line that’s only a page number: “12”, “- 12 -”, “Page 3”, “Page 3 of 10”, “3/10”. */
const PAGE_NUMBER = /^(page\s+)?[-–—\s]*\d+[-–—\s]*((of|\/)\s*\d+)?$/i;

/** A line this short, seen this many times, is a running head, not writing. */
const RUNNING_HEAD_REPEATS = 3;
const RUNNING_HEAD_WORDS = 8;

function clean(text: string | null | undefined): string {
	return (text ?? '').replace(/\s+/g, ' ').trim();
}

function webSource(url: string, title: string, group: string, paragraphs: string[]): WebSource {
	return { id: webSourceId(url), url, title, group, documents: broughtDocuments(paragraphs) };
}
