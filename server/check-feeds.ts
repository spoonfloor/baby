import { parseArgs } from 'node:util';
import { JSDOM } from 'jsdom';
import { extract } from '#lib/web/extract.ts';
import { fetchThroughServer, type FetchedText } from '#lib/web/fetchThroughServer.ts';
import { SUGGESTED_FEEDS } from '#lib/web/suggestedFeeds.ts';

/**
 * Checks the feeds Read from URL suggests (src/lib/web/suggestedFeeds.ts): each must
 * reach the app as a feed whose posts carry their whole text. Fetches through the save
 * server, as the app does, when BABY_SERVER and BABY_TOKEN name it; otherwise straight
 * from this machine, which only shows a feed is full text, not that the server may read it.
 *
 *   BABY_SERVER=https://baby.example.com BABY_TOKEN=… npm run check-feeds
 *   npm run check-feeds -- https://example.com/feed   check other feeds instead
 */

/** Fewer words than this in an average post is a feed of teasers. */
const MIN_AVERAGE_WORDS = 150;

const { positionals } = parseArgs({ allowPositionals: true });

// extract.ts parses with the browser’s DOMParser.
globalThis.DOMParser = new JSDOM().window.DOMParser;

const server = process.env['BABY_SERVER'];
const token = process.env['BABY_TOKEN'];
const fetchText: (url: string) => Promise<FetchedText> =
	server && token
		? (url) => fetchThroughServer({ address: server.replace(/\/$/, ''), token }, url)
		: fetchDirectly;

async function fetchDirectly(url: string): Promise<FetchedText> {
	const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
	if (!response.ok) throw new Error(`answered ${response.status}`);
	return {
		url: response.url,
		contentType: response.headers.get('Content-Type') ?? 'text/html',
		text: await response.text()
	};
}

/** Why `url` isn’t a good suggestion, or a summary of it if it is. */
async function check(url: string): Promise<{ ok: boolean; says: string }> {
	let found;
	try {
		found = extract(await fetchText(url));
	} catch (error) {
		return { ok: false, says: `couldn’t fetch: ${(error as Error).message}` };
	}
	if (found.kind !== 'feed') return { ok: false, says: 'not a feed' };
	if (found.sources.length === 0) return { ok: false, says: 'no posts' };
	const words = found.sources.map(({ documents }) =>
		documents.reduce(
			// Tokens include punctuation marks and [EOS]; only words count.
			(sum, document) => sum + document.filter((token) => /^[\p{L}\p{N}]/u.test(token)).length,
			0
		)
	);
	const average = Math.round(words.reduce((sum, count) => sum + count, 0) / words.length);
	const says = `“${found.title}”, ${found.sources.length} posts, ${average} words each on average`;
	return { ok: average >= MIN_AVERAGE_WORDS, says };
}

const urls = positionals.length > 0 ? positionals : SUGGESTED_FEEDS.map(({ url }) => url);
console.log(
	server && token
		? `Checking ${urls.length} feeds through ${server}`
		: `Checking ${urls.length} feeds from this machine (set BABY_SERVER and BABY_TOKEN to check through your server)`
);
const results = await Promise.all(urls.map(async (url) => ({ url, ...(await check(url)) })));
for (const { url, ok, says } of results)
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${url}\n     ${says}`);
if (results.some(({ ok }) => !ok)) process.exitCode = 1;
