import { describe, expect, it } from 'vitest';
import { groups } from './index.ts';

describe('groups', () => {
	const primers = groups.flatMap((group) => group.primers);

	it('gives every primer a unique id', () => {
		expect(new Set(primers.map((primer) => primer.id)).size).toBe(primers.length);
	});

	it('starts every conversation with you and ends it on Baby’s turn', () => {
		for (const document of primers.flatMap((primer) => primer.documents)) {
			// Each turn begins right after the previous one’s [EOS].
			const lastTurn = document.lastIndexOf('[EOS]', -2) + 1;
			expect(document[0]).toBe('[YOU]');
			expect(document[lastTurn]).toBe('[BABY]');
		}
	});
});
