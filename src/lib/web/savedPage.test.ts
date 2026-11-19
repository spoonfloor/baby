import { describe, expect, it } from 'vitest';
import { savedPage, SavedPageError } from './savedPage.ts';

const PAGE = 'https://example.com/post';

describe('savedPage', () => {
	it('reads a saved page as if fetched from the address the site refused', async () => {
		const file = new File(['<p>Café</p>'], 'Post.html', { type: 'text/html' });
		expect(await savedPage(file, PAGE)).toEqual({
			url: PAGE,
			contentType: 'text/html',
			text: '<p>Café</p>'
		});
	});

	it('knows a page by its extension when the system gives no type', async () => {
		const file = new File(['<p>Hi</p>'], 'Post.HTM');
		expect((await savedPage(file, PAGE)).contentType).toBe('text/html');
	});

	it('decodes in the charset the page names', async () => {
		// “Café” in Latin-1: é is one byte, 0xE9, which UTF-8 would garble.
		const bytes = new Uint8Array([
			...new TextEncoder().encode('<meta charset=iso-8859-1><p>Caf'),
			0xe9,
			...new TextEncoder().encode('</p>')
		]);
		const file = new File([bytes], 'Post.html', { type: 'text/html' });
		expect((await savedPage(file, PAGE)).text).toBe('<meta charset=iso-8859-1><p>Café</p>');
	});

	it('names a Safari web archive, and turns away anything else', async () => {
		const problem = (name: string) =>
			savedPage(new File(['x'], name), PAGE).catch((error: unknown) =>
				error instanceof SavedPageError ? error.problem : error
			);
		expect(await problem('Post.webarchive')).toBe('webarchive');
		expect(await problem('Post.pdf')).toBe('type');
	});
});
