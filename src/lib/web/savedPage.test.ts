// @vitest-environment jsdom
import { File as NodeFile } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { addressOf, pastedPage, savedPage, SavedPageError } from './savedPage.ts';

const PAGE = 'https://example.com/post';

/** A file as a browser gives one; jsdom’s can’t be read, so Node’s stands in. */
const file = (parts: (string | Uint8Array)[], name: string, type?: string) =>
	new NodeFile(parts, name, type === undefined ? {} : { type }) as unknown as File;

describe('savedPage', () => {
	it('reads a saved page as if fetched from the address the site refused', async () => {
		const saved = file(['<p>Café</p>'], 'Post.html', 'text/html');
		expect(await savedPage(saved, PAGE)).toEqual({
			url: PAGE,
			contentType: 'text/html',
			text: '<p>Café</p>'
		});
	});

	it('knows a page by its extension when the system gives no type', async () => {
		const saved = file(['<p>Hi</p>'], 'Post.HTM');
		expect((await savedPage(saved, PAGE)).contentType).toBe('text/html');
	});

	it('decodes in the charset the page names', async () => {
		// “Café” in Latin-1: é is one byte, 0xE9, which UTF-8 would garble.
		const bytes = new Uint8Array([
			...new TextEncoder().encode('<meta charset=iso-8859-1><p>Caf'),
			0xe9,
			...new TextEncoder().encode('</p>')
		]);
		const saved = file([bytes], 'Post.html', 'text/html');
		expect((await savedPage(saved, PAGE)).text).toBe('<meta charset=iso-8859-1><p>Café</p>');
	});

	it('names a Safari web archive, and turns away anything else', async () => {
		const problem = (name: string) =>
			savedPage(file(['x'], name), PAGE).catch((error: unknown) =>
				error instanceof SavedPageError ? error.problem : error
			);
		expect(await problem('Post.webarchive')).toBe('webarchive');
		expect(await problem('Post.pdf')).toBe('type');
	});
});

describe('a page saved from another site', () => {
	const saved = (html: string) =>
		savedPage(file([html], 'Post.html', 'text/html'), PAGE).catch((error: unknown) => error);

	it('is turned away, naming both sites', async () => {
		const error = await saved(
			'<!-- saved from url=(0024)https://other.org/thing -->\n<html><p>Hi</p></html>'
		);
		expect(error).toBeInstanceOf(SavedPageError);
		expect(error).toMatchObject({
			problem: 'elsewhere',
			sites: { file: 'other.org', page: 'example.com' }
		});
	});

	it('is told by its canonical address when the browser noted none', async () => {
		expect(
			// eslint-disable-next-line no-restricted-syntax -- HTML attributes need straight quotes
			await saved('<link rel="canonical" href="https://other.org/thing"><p>Hi</p>')
		).toMatchObject({ problem: 'elsewhere' });
	});

	it('reads a page from the same site, or a part of it, or one that names no address', async () => {
		for (const html of [
			// eslint-disable-next-line no-restricted-syntax -- HTML attributes need straight quotes
			'<link rel="canonical" href="https://www.example.com/post?ref=feed"><p>Hi</p>',
			// eslint-disable-next-line no-restricted-syntax -- HTML attributes need straight quotes
			'<meta property="og:url" content="https://m.example.com/post"><p>Hi</p>',
			// eslint-disable-next-line no-restricted-syntax -- HTML attributes need straight quotes
			'<link rel="canonical" href="/post"><p>Hi</p>',
			'<p>Hi</p>'
		]) {
			expect(await saved(html)).toMatchObject({ url: PAGE });
		}
	});
});

describe('addressOf', () => {
	it('prefers where the browser saved it from', () => {
		const html =
			'<!-- saved from url=(0024)https://saved.example/a -->' +
			// eslint-disable-next-line no-restricted-syntax -- HTML attributes need straight quotes
			'<link rel="canonical" href="https://canonical.example/a">';
		expect(addressOf(html, PAGE)).toBe('https://saved.example/a');
	});

	it('skips what isn’t a web address', () => {
		expect(
			addressOf(
				// eslint-disable-next-line no-restricted-syntax -- HTML attributes need straight quotes
				'<link rel="canonical" href="javascript:void 0"><meta property="og:url" content="https://example.com/b">',
				PAGE
			)
		).toBe('https://example.com/b');
	});
});

describe('pastedPage', () => {
	it('reads the HTML a paste carried', () => {
		expect(pastedPage({ text: 'One', html: '<p>One</p>' }, PAGE)).toEqual({
			url: PAGE,
			contentType: 'text/html',
			text: '<p>One</p>'
		});
	});

	it('reads plain text a paragraph to a line, as a copied page has it', () => {
		expect(pastedPage({ text: 'One\nTwo\n\nThree' }, PAGE).text).toBe('One\n\nTwo\n\nThree');
	});
});
