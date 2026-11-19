import { writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

/**
 * Captures the articles `reading-the-web.ts` reads: fetches each page and turns it
 * into paragraphs with the app’s own extraction (`readPage`, as Read from URL does),
 * then saves them, so every run reads the same text however the sites change.
 *
 *   node --experimental-strip-types lab/experiments/web/capture.ts
 */

/** Recent news articles of different kinds and lengths, one per site. */
const URLS = [
	'https://www.tmz.com/2026/11/19/brittany-boltinhouse-denies-n-word-apology/',
	'https://www.bbc.com/news/articles/c58j484089ewo',
	'https://www.theguardian.com/world/2026/nov/19/ukraine-war-briefing-russia-embassy-netherlands-destinus-missiles-kerch-crimea-bridge-strike',
	'https://www.npr.org/2026/11/19/nx-s1-6042558/anthropic-ipo-breaks-records-100-billion'
];

export interface Article {
	url: string;
	title: string;
	paragraphs: string[];
}

// The app extracts in the browser; jsdom stands in for its DOMParser here.
globalThis.DOMParser = new JSDOM('').window.DOMParser;
const { readPage } = await import('#lib/web/extract.ts');

const articles: Article[] = [];
for (const url of URLS) {
	// A generic client name, as the save server sends: nothing about who is reading.
	const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
	if (!response.ok) throw new Error(`${url} answered ${response.status}`);
	const { title, paragraphs } = readPage(await response.text(), url);
	articles.push({ url, title, paragraphs });
	console.log(`${title} · ${paragraphs.length} paragraphs`);
}
await writeFile(
	new URL('./articles.json', import.meta.url),
	JSON.stringify(articles, null, '\t') + '\n'
);
