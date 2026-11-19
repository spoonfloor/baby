// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FetchProblemError, type FetchedText } from './fetchThroughServer.ts';
import { readable } from './readable.ts';

/* eslint-disable no-restricted-syntax -- HTML and XML attributes need straight quotes */
const FRONT_PAGE = `<html><head><title>Example Gardens</title>
	<link rel="alternate" type="application/rss+xml" href="/feed"></head>
	<body><nav><a href="/">Home</a></nav><p>Latest from the garden.</p></body></html>`;
const FEED = `<?xml version="1.0"?><rss version="2.0"><channel><title>Example Gardens</title>
	<item><title>Frost</title><link>/frost</link><description>Cover the beds.</description></item>
	</channel></rss>`;
const EMPTY_FEED = `<?xml version="1.0"?><rss version="2.0"><channel><title>Example Gardens</title></channel></rss>`;
/* eslint-enable no-restricted-syntax */

/** A site whose addresses answer with these texts; any other address is missing. */
function site(pages: Record<string, { contentType: string; text: string }>) {
	const asked: string[] = [];
	const fetchText = (url: string): Promise<FetchedText> => {
		asked.push(url);
		const page = pages[url];
		return page
			? Promise.resolve({ url, ...page })
			: Promise.reject(new FetchProblemError('missing', 'Not found'));
	};
	return { asked, fetchText };
}

describe('readable', () => {
	it('reads the feed a front page offers in place of the page', async () => {
		const { asked, fetchText } = site({
			'https://example.com/': { contentType: 'text/html', text: FRONT_PAGE },
			'https://example.com/feed': { contentType: 'application/rss+xml', text: FEED }
		});
		const found = await readable(fetchText, 'https://example.com/');
		expect(asked).toEqual(['https://example.com/', 'https://example.com/feed']);
		expect(found.kind === 'feed' && found.sources.map(({ url }) => url)).toEqual([
			'https://example.com/frost'
		]);
	});

	it('reads the page after all if its feed can’t be fetched or has no posts', async () => {
		const page = { contentType: 'text/html', text: FRONT_PAGE };
		const missing = site({ 'https://example.com/': page });
		expect((await readable(missing.fetchText, 'https://example.com/')).kind).toBe('page');

		const empty = site({
			'https://example.com/': page,
			'https://example.com/feed': { contentType: 'application/rss+xml', text: EMPTY_FEED }
		});
		expect((await readable(empty.fetchText, 'https://example.com/')).kind).toBe('page');
	});
});
