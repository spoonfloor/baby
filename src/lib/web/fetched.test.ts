import { describe, expect, it } from 'vitest';
import { addFetched, laterArrivals, type Fetched } from './fetched.ts';
import type { BroughtSource } from './brought.ts';

const post = (name: string, text = name): BroughtSource => ({
	id: `web:https://example.com/${name}`,
	url: `https://example.com/${name}`,
	title: name,
	group: 'Example',
	documents: [[text, '[EOS]']]
});

describe('addFetched', () => {
	it('puts the newest fetch first, keeping each feed’s order', () => {
		const first = addFetched([], [post('b'), post('a')], 1).all;
		const second = addFetched(first, [post('d'), post('c')], 2).all;
		expect(second.map(({ source }) => source.title)).toEqual(['d', 'c', 'b', 'a']);
	});

	it('keeps a source’s first text and place when it’s fetched again', () => {
		const first: Fetched[] = addFetched([], [post('b'), post('a', 'old')], 1).all;
		const { all, changed } = addFetched(first, [post('c'), post('a', 'new'), post('c')], 2);
		expect(changed.map(({ source }) => source.title)).toEqual(['c']);
		expect(all.map(({ source }) => [source.title, source.documents[0]?.[0]])).toEqual([
			['c', 'c'],
			['b', 'b'],
			['a', 'old']
		]);
	});

	it('replaces a feed’s teaser with the page read on its own, keeping its group and place', () => {
		const feed = addFetched([], [post('b'), post('a', 'teaser')], 1).all;
		const page = { ...post('a', 'whole article'), title: 'A, in full', group: 'example.com' };
		const { all, changed } = addFetched(feed, [page], 2, { replacing: true });
		expect(changed.map(({ source }) => source.documents[0]?.[0])).toEqual(['whole article']);
		expect(all.map(({ source }) => [source.title, source.group, source.documents[0]?.[0]])).toEqual(
			[
				['b', 'Example', 'b'],
				['A, in full', 'Example', 'whole article']
			]
		);
	});
});

describe('laterArrivals', () => {
	it('is what came in a group after it was first brought, not other groups’ first fetch', () => {
		const first = addFetched([], [post('b'), post('a')], 1).all;
		const other = addFetched(first, [{ ...post('x'), group: 'Other' }], 2).all;
		const again = addFetched(other, [post('c'), post('b')], 3).all;
		expect([...laterArrivals(again)]).toEqual(['web:https://example.com/c']);
	});
});
