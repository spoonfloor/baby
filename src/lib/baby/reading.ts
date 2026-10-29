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

/** “412 words · 13 sources”: what Baby knows, in the sources panel. */
export function describeKnowledge(words: number, sources: number): string {
	return words === 0 ? 'No words yet' : `${count(words, 'word')} · ${count(sources, 'source')}`;
}

/** “3 words”, “1 word”. */
export function count(n: number, noun: string): string {
	return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
