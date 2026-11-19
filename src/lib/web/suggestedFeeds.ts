/**
 * Feeds Read from URL suggests: sites that let a server read them and whose feeds carry
 * each post’s whole text, not a teaser, so reading one gives Baby real writing and
 * reading it again later brings its new posts. `npm run check-feeds` confirms each
 * still does.
 */

export interface SuggestedFeed {
	/** The site’s own name, as the suggestion shows it. */
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
