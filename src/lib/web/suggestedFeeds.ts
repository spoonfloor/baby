import type { Extracted } from './extract.ts';

/**
 * Feeds Read from URL suggests: sites that let a server read them and whose feeds carry
 * each post’s whole text, not a teaser, so reading one gives Baby real writing and
 * reading it again later brings its new posts. `npm run check-feeds` confirms each
 * still does.
 */

export interface SuggestedFeed {
	/** The site’s own name, as the suggestion shows it and as its posts are grouped. */
	name: string;
	url: string;
}

/** A spread of subjects, each feed with dozens to thousands of words a post. */
export const SUGGESTED_FEEDS: readonly SuggestedFeed[] = [
	{ name: 'The Conversation', url: 'https://theconversation.com/us/articles.atom' },
	{ name: 'The Marginalian', url: 'https://www.themarginalian.org/feed/' },
	{ name: 'Atlas Obscura', url: 'https://www.atlasobscura.com/feeds/latest' },
	{ name: 'Hakai Magazine', url: 'https://hakaimagazine.com/feed/' },
	{ name: 'NASA', url: 'https://www.nasa.gov/feed/' },
	{ name: 'Open Culture', url: 'https://www.openculture.com/feed' },
	{ name: 'Longreads', url: 'https://longreads.com/feed/' }
];

/**
 * `found` at `url` under its suggestion’s short name, if `url` is a suggested feed’s,
 * since feeds often title themselves at length (“Atlas Obscura - Latest Articles and
 * Places”). However it’s read, a suggested feed’s posts stay in one group.
 */
export function named(found: Extracted, url: string): Extracted {
	const name = SUGGESTED_FEEDS.find((feed) => feed.url === url)?.name;
	if (found.kind !== 'feed' || name === undefined) return found;
	return {
		kind: 'feed',
		title: name,
		sources: found.sources.map((source) => ({ ...source, group: name }))
	};
}
