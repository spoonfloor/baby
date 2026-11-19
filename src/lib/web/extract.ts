import { Readability } from '@mozilla/readability';
import { proseDocuments } from '#lib/baby/reading.ts';
import type { FetchedText } from './fetchThroughServer.ts';
import { siteOf, webSourceId, type WebSource } from './webSource.ts';

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
	const page = new DOMParser().parseFromString(html, 'text/html');
	const base = page.createElement('base');
	base.href = url;
	page.head.prepend(base);
	const fallbackTitle = clean(page.title) || url;
	const feed = offeredFeed(page);
	const article = new Readability(page).parse();
	const paragraphs = article?.content
		? htmlParagraphs(article.content)
		: htmlParagraphs(page.body.innerHTML);
	const source = webSource(
		url,
		clean(article?.title ?? '') || fallbackTitle,
		siteOf(url),
		paragraphs
	);
	return feed === undefined ? { source } : { source, feed };
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
	const body = new DOMParser().parseFromString(html, 'text/html').body;
	for (const element of body.querySelectorAll(NOT_PROSE)) element.remove();
	const blocks = [...body.querySelectorAll(BLOCKS)].filter((block) => !block.querySelector(BLOCKS));
	if (blocks.length === 0) return plainParagraphs(body.textContent ?? '');
	return blocks.map((block) => clean(block.textContent)).filter((text) => text !== '');
}

/** Plain text, a paragraph between blank lines. */
function plainParagraphs(text: string): string[] {
	return text
		.split(/\n\s*\n/)
		.map(clean)
		.filter((paragraph) => paragraph !== '');
}

function clean(text: string | null | undefined): string {
	return (text ?? '').replace(/\s+/g, ' ').trim();
}

function webSource(url: string, title: string, group: string, paragraphs: string[]): WebSource {
	return { id: webSourceId(url), url, title, group, documents: proseDocuments(paragraphs) };
}
