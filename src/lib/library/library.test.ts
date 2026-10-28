import { describe, expect, it } from 'vitest';
import { shelves } from './index.ts';

describe('shelves', () => {
	const packs = shelves.flatMap((shelf) => shelf.packs);

	it('gives every pack a unique id', () => {
		expect(new Set(packs.map((pack) => pack.id)).size).toBe(packs.length);
	});

	it('starts every conversation with you and ends it on Baby’s turn', () => {
		for (const document of packs.flatMap((pack) => pack.documents)) {
			// Each turn begins right after the previous one’s [EOS].
			const lastTurn = document.lastIndexOf('[EOS]', -2) + 1;
			expect(document.slice(0, 2)).toEqual(['you', ':']);
			expect(document.slice(lastTurn, lastTurn + 2)).toEqual(['baby', ':']);
		}
	});
});
