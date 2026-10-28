import { describe, expect, it } from 'vitest';
import { describeReading, readingStats } from './reading.ts';

describe('readingStats', () => {
	it('counts every word but [EOS], and each new word once', () => {
		const documents = [
			['you', ':', 'hi', '[EOS]'],
			['you', ':', 'bye', '[EOS]']
		];
		const known = new Set(['you', ':']);

		expect(readingStats(documents, (word) => known.has(word))).toEqual({ words: 6, newWords: 2 });
	});
});

describe('describeReading', () => {
	it('reads the same before and after reading', () => {
		expect(describeReading({ words: 1, newWords: 0 })).toBe('1 word · 0 new');
		expect(describeReading({ words: 412, newWords: 38 })).toBe('412 words · 38 new');
	});
});
