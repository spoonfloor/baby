import { isSpecial } from './vocabulary.ts';

/** One thing Baby reads in a single sitting, as the exact tokens it trains on. */
export type Document = string[];

export interface ReadingStats {
	/** Words read, not counting [EOS]. */
	words: number;
	/** Distinct words Baby didn’t know before. */
	newWords: number;
}

/** What reading `documents` would add, given which words Baby already knows. */
export function readingStats(
	documents: readonly Document[],
	isKnown: (word: string) => boolean
): ReadingStats {
	const words = documents.flat().filter((token) => !isSpecial(token));
	const newWords = new Set(words.filter((word) => !isKnown(word))).size;
	return { words: words.length, newWords };
}

/** “412 words · 38 new”: the same wording before reading (preview) and after (status). */
export function describeReading({ words, newWords }: ReadingStats): string {
	return `${count(words, 'word')} · ${newWords} new`;
}

/** “Baby knows 10.9K words”: what Baby knows, in the sources panel. */
export function describeKnowledge(words: number): string {
	return words === 0 ? 'Baby knows no words' : `Baby knows ${countRounded(words, 'word')}`;
}

/** “10.9K new words”: what reading a source would add, in the sources panel. */
export function describeNewWords(newWords: number): string {
	return newWords === 0 ? 'No new words' : countRounded(newWords, 'new word');
}

/** “3 words”, “1 word”. */
export function count(n: number, noun: string): string {
	return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

const rounded = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/** “8 words”, “10.9K words”, “123M words”: a count to take in at a glance. */
function countRounded(n: number, noun: string): string {
	return `${rounded.format(n)} ${noun}${n === 1 ? '' : 's'}`;
}
