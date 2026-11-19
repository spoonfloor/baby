import { extract, type Extracted } from './extract.ts';
import { FetchProblemError, type FetchedText } from './fetchThroughServer.ts';

/**
 * What to read at `url`. A site’s or section’s front page that offers a feed gives
 * that feed’s posts instead: its writing, without the menus and headlines around it.
 * If the feed can’t be fetched or has no posts, the page is read after all.
 */
export async function readable(
	fetchText: (url: string) => Promise<FetchedText>,
	url: string
): Promise<Extracted> {
	const found = extract(await fetchText(url));
	if (found.kind !== 'page' || found.feed === undefined) return found;
	try {
		const feed = extract(await fetchText(found.feed));
		if (feed.kind === 'feed' && feed.sources.length > 0) return feed;
	} catch (error) {
		if (!(error instanceof FetchProblemError)) throw error;
	}
	return found;
}
