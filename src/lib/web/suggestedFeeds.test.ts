import { describe, expect, it } from 'vitest';
import type { Extracted } from './extract.ts';
import { named, SUGGESTED_FEEDS } from './suggestedFeeds.ts';

const feed = (url: string): Extracted => ({
	kind: 'feed',
	title: 'A Long Title - Latest Articles',
	sources: [
		{
			id: `web:${url}/1`,
			url: `${url}/1`,
			title: 'One',
			group: 'A Long Title - Latest Articles',
			documents: [['One', '[EOS]']]
		}
	]
});

describe('named', () => {
	it('groups a suggested feed’s posts under its short name', () => {
		const [suggested] = SUGGESTED_FEEDS;
		if (!suggested) throw new Error('No suggested feeds');
		const found = named(feed(suggested.url), suggested.url);
		expect(found.kind === 'feed' && [found.title, found.sources[0]?.group]).toEqual([
			suggested.name,
			suggested.name
		]);
	});

	it('leaves any other feed as it titles itself', () => {
		const other = feed('https://example.com/feed');
		expect(named(other, 'https://example.com/feed')).toBe(other);
	});
});
