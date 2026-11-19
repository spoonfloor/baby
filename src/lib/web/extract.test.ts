// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { extract, htmlParagraphs } from './extract.ts';

const words = (documents: string[][]) => documents.map((document) => document.join(' '));

describe('extract', () => {
	it('reads a page’s article, a paragraph to a document, leaving out the page around it', () => {
		const article = Array.from(
			{ length: 6 },
			(_, index) =>
				`<p>Tomatoes split when rain follows a dry spell, paragraph ${index}, because the fruit swells faster than its skin can stretch, and gardeners who water deeply and evenly see far fewer cracks.</p>`
		).join('');
		const extracted = extract({
			url: 'https://example.com/tomatoes',
			contentType: 'text/html; charset=utf-8',
			// eslint-disable-next-line no-restricted-syntax -- HTML and XML attributes need straight quotes
			text: `<html><head><title>Why tomatoes split | Example</title></head><body>
				<nav><ul><li><a href="/">Home</a></li><li><a href="/about">About</a></li></ul></nav>
				<article><h1>Why tomatoes split</h1>${article}</article>
				<footer><p>© Example Gardens</p></footer></body></html>`
		});
		expect(extracted.kind).toBe('page');
		if (extracted.kind !== 'page') return;
		const { source } = extracted;
		expect(source.id).toBe('web:https://example.com/tomatoes');
		expect(source.title).toMatch(/tomatoes split/i);
		const text = words(source.documents);
		expect(text[0]).toMatch(/^tomatoes split when rain .* \[EOS\]$/);
		expect(text.join(' ')).not.toMatch(/about|example gardens/);
	});

	it('reads an RSS feed as one source per post, at the post’s address', () => {
		const extracted = extract({
			url: 'https://example.com/feed',
			contentType: 'application/rss+xml',
			// eslint-disable-next-line no-restricted-syntax -- HTML and XML attributes need straight quotes
			text: `<?xml version="1.0"?>
				<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
				<channel><title>Example Gardens</title>
					<item><title>Seed saving</title><link>https://example.com/seeds</link>
						<description>Short summary.</description>
						<content:encoded><![CDATA[<p>Dry the seeds.</p><p>Label the jar.</p>]]></content:encoded>
					</item>
					<item><title>Frost</title><link>/frost</link>
						<description>&lt;p&gt;Cover the beds.&lt;/p&gt;</description></item>
					<item><title>Nothing to read</title><link>/empty</link></item>
				</channel></rss>`
		});
		expect(extracted.kind).toBe('feed');
		if (extracted.kind !== 'feed') return;
		expect(extracted.title).toBe('Example Gardens');
		// Grouped by the feed they came in, wherever each post links.
		expect(extracted.sources.map(({ group }) => group)).toEqual([
			'Example Gardens',
			'Example Gardens'
		]);
		expect(
			extracted.sources.map(({ url, title, documents }) => ({ url, title, text: words(documents) }))
		).toEqual([
			{
				url: 'https://example.com/seeds',
				title: 'Seed saving',
				text: ['dry the seeds . [EOS]', 'label the jar . [EOS]']
			},
			{ url: 'https://example.com/frost', title: 'Frost', text: ['cover the beds . [EOS]'] }
		]);
	});

	it('reads an Atom feed', () => {
		const extracted = extract({
			url: 'https://example.com/atom.xml',
			contentType: 'application/atom+xml',
			// eslint-disable-next-line no-restricted-syntax -- HTML and XML attributes need straight quotes
			text: `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Notes</title>
				<entry><title>One</title><link rel="alternate" href="https://example.com/one"/>
					<content type="html">&lt;p&gt;First note.&lt;/p&gt;</content></entry>
				<entry><title>Two</title><link href="https://example.com/two"/>
					<summary>Second note.</summary></entry></feed>`
		});
		expect(extracted.kind === 'feed' && extracted.sources.map(({ url }) => url)).toEqual([
			'https://example.com/one',
			'https://example.com/two'
		]);
	});

	it('notices the feed a front page offers, but not one a post’s page links', () => {
		const page = (head: string) =>
			extract({
				url: 'https://example.com/garden/',
				contentType: 'text/html',
				text: `<html><head>${head}</head><body><p>Latest from the garden.</p></body></html>`
			});
		// eslint-disable-next-line no-restricted-syntax -- HTML attributes need straight quotes
		const link = '<link rel="alternate" type="application/rss+xml" href="feed.xml">';
		const feed = (head: string) => {
			const extracted = page(head);
			return extracted.kind === 'page' ? extracted.feed : 'not a page';
		};

		expect(feed(link)).toBe('https://example.com/garden/feed.xml');
		// eslint-disable-next-line no-restricted-syntax -- HTML attributes need straight quotes
		expect(feed(`<meta property="og:type" content="website">${link}`)).toBe(
			'https://example.com/garden/feed.xml'
		);
		// eslint-disable-next-line no-restricted-syntax -- HTML attributes need straight quotes
		expect(feed(`<meta property="og:type" content="article">${link}`)).toBeUndefined();
		// eslint-disable-next-line no-restricted-syntax -- HTML attributes need straight quotes
		expect(feed('<link rel="alternate" hreflang="fr" href="/fr/">')).toBeUndefined();
		expect(feed('')).toBeUndefined();
	});

	it('reads plain text a paragraph at a time', () => {
		const extracted = extract({
			url: 'https://example.com/notes.txt',
			contentType: 'text/plain',
			text: 'Hello there.\n\nGood to see you.\n'
		});
		expect(extracted.kind === 'page' && words(extracted.source.documents)).toEqual([
			'hello there . [EOS]',
			'good to see you . [EOS]'
		]);
	});
});

describe('htmlParagraphs', () => {
	it('counts nested blocks once and reads text with no markup as plain text', () => {
		expect(htmlParagraphs('<ul><li><p>One</p></li><li>Two</li></ul><script>x()</script>')).toEqual([
			'One',
			'Two'
		]);
		expect(htmlParagraphs('Just a summary.')).toEqual(['Just a summary.']);
	});

	it('leaves out tables and footnote marks', () => {
		expect(
			htmlParagraphs(
				// eslint-disable-next-line no-restricted-syntax -- HTML attributes need straight quotes
				'<table><tr><th>Born</th><td>620 BCE</td></tr></table><p>Aesop told fables.<sup><a href="#n1">[1]</a></sup> E = mc<sup>2</sup></p>'
			)
		).toEqual(['Aesop told fables. E = mc2']);
	});
});
