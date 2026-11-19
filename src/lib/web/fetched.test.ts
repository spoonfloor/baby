import { describe, expect, it } from 'vitest';
import { addFetched, type Fetched } from './fetched.ts';
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
		const { all, added } = addFetched(first, [post('c'), post('a', 'new'), post('c')], 2);
		expect(added.map(({ source }) => source.title)).toEqual(['c']);
		expect(all.map(({ source }) => [source.title, source.documents[0]?.[0]])).toEqual([
			['c', 'c'],
			['b', 'b'],
			['a', 'old']
		]);
	});
});
