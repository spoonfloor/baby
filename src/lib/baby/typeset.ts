/**
 * Baby’s words as ordinary text, for reading. Baby only ever says lowercase words
 * with punctuation marks as words of their own (see `tokenize`), so the app sets
 * them the way a person would write them: marks against the word before, sentences
 * and names capitalized, apostrophes curly. Baby’s actual words stay as they were
 * wherever the app shows what Baby really did (the transcript, the lab).
 */

/** Marks that sit against the word before them, with no space. */
const CLOSING = new Set(['.', ',', '!', '?', ':', ';', ')', '…']);
/** Marks that sit against the word after them. */
const OPENING = new Set(['(']);
/** Marks that end a sentence, so the next word starts with a capital. */
const SENTENCE_END = new Set(['.', '!', '?']);
/** Words that are always capitalized wherever they fall. */
const NAMES = new Set(['baby']);

// Code, not copy: tokens use the straight apostrophe (see vocabulary.ts).
// eslint-disable-next-line no-restricted-syntax
const APOSTROPHE = "'";

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** “i”, and its contractions (“i'm”), are always capitalized. */
const isI = (word: string) => word === 'i' || word.startsWith(`i${APOSTROPHE}`);

export function typeset(words: readonly string[]): string {
	return typesetWords(words).join('');
}

/** `typeset`, word by word: each word as it’s written, with the space before it if any. */
export function typesetWords(words: readonly string[]): string[] {
	const shownWords: string[] = [];
	let sentenceStart = true;
	let previous: string | undefined;
	for (const word of words) {
		let shown = word.replaceAll(APOSTROPHE, '’');
		if (sentenceStart || NAMES.has(word) || isI(word)) shown = capitalize(shown);
		const spaced = previous !== undefined && !CLOSING.has(word) && !OPENING.has(previous);
		shownWords.push((spaced ? ' ' : '') + shown);
		if (SENTENCE_END.has(word)) sentenceStart = true;
		else if (!CLOSING.has(word) && !OPENING.has(word)) sentenceStart = false;
		previous = word;
	}
	return shownWords;
}
