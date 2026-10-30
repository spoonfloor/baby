import { describe, expect, it } from 'vitest';
import { describeKnowledge, describeNewWords, describeReading, readingStats } from './reading.ts';

describe('readingStats', () => {
	it('counts every word but the markers, and each new word once', () => {
		const documents = [
			['[YOU]', 'hi', 'you', '[EOS]'],
			['[YOU]', 'bye', 'you', '[EOS]']
		];
		const known = new Set(['you']);

		expect(readingStats(documents, (word) => known.has(word))).toEqual({ words: 4, newWords: 2 });
	});
});

describe('describeReading', () => {
	it('reads the same before and after reading', () => {
		expect(describeReading({ words: 1, newWords: 0 })).toBe('1 word · 0 new');
		expect(describeReading({ words: 412, newWords: 38 })).toBe('412 words · 38 new');
	});
});

describe('describeKnowledge', () => {
	it('rounds big counts, and says when there are none', () => {
		expect(describeKnowledge(0)).toBe('Baby knows no words');
		expect(describeKnowledge(1)).toBe('Baby knows 1 word');
		expect(describeKnowledge(10_940)).toBe('Baby knows 10.9K words');
	});
});

describe('describeNewWords', () => {
	it('rounds big counts, and says when there are none', () => {
		expect(describeNewWords(0)).toBe('No new words');
		expect(describeNewWords(1)).toBe('1 new word');
		expect(describeNewWords(8)).toBe('8 new words');
		expect(describeNewWords(10_940)).toBe('10.9K new words');
		expect(describeNewWords(123_000_000)).toBe('123M new words');
	});
});
