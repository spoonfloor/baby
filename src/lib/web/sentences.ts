import { proseDocuments, type Document } from '#lib/baby/reading.ts';

/** What Baby reads of a page or a file you bring: its sentences (`readableSentences`), a document each. */
export function broughtDocuments(paragraphs: readonly string[]): Document[] {
	return proseDocuments(readableSentences(paragraphs));
}

/**
 * What Baby reads of text you bring: its whole sentences, one to a document, so it
 * learns to say one sentence and stop rather than run on into the next. Leaves out
 * what isn’t a sentence of writing: headings and titles, page numbers, captions and
 * fragments, lines of links or numbers, and sentences it has already kept. Text with
 * no sentences at all, like a list or a poem, is kept line for line.
 */
export function readableSentences(paragraphs: readonly string[]): string[] {
	const kept = new Set<string>();
	for (const paragraph of paragraphs) {
		for (const sentence of splitSentences(paragraph)) {
			if (isWriting(sentence)) kept.add(sentence);
		}
	}
	return kept.size > 0 ? [...kept] : [...paragraphs];
}

const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });

/**
 * Titles and abbreviations a period follows without ending the sentence: “Dr. Lee”.
 * The segmenter splits after them; lowercase ones (“e.g.”, “p.m.”) are caught by the
 * next sentence starting in lowercase instead.
 */
const ABBREVIATIONS = new Set(
	['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'St', 'Mt', 'Ft', 'Jr', 'Sr', 'Gen', 'Col', 'Lt', 'Sgt']
		.concat(['Capt', 'Sen', 'Rep', 'Gov', 'Pres', 'Rev', 'Hon', 'No', 'Vol', 'Fig', 'Inc'])
		.concat(['Co', 'Corp', 'Ltd', 'Jan', 'Feb', 'Mar', 'Apr', 'Aug', 'Sept', 'Sep', 'Oct'])
		.concat(['Nov', 'Dec'])
);

/** `text` split into sentences, mending the segmenter’s splits after a title or a quote. */
export function splitSentences(text: string): string[] {
	const sentences: string[] = [];
	for (const { segment } of segmenter.segment(text)) {
		const sentence = segment.trim();
		if (sentence === '') continue;
		const previous = sentences.at(-1);
		if (previous !== undefined && continues(previous, sentence)) {
			sentences[sentences.length - 1] = `${previous} ${sentence}`;
		} else {
			sentences.push(sentence);
		}
	}
	return sentences;
}

/** Whether `next` carries on `previous` rather than starting a sentence of its own. */
function continues(previous: string, next: string): boolean {
	if (/^[\p{Ll}]/u.test(next)) return true;
	const last = /(\p{L}+)\.$/u.exec(previous)?.[1];
	return last !== undefined && (ABBREVIATIONS.has(last) || /^\p{Lu}$/u.test(last));
}

/** Fewest words a sentence needs: one word with a period is a label (“Advertisement.”), not writing. */
const MIN_WORDS = 2;

/** A sentence of writing, not a heading, a label, or a line of links or figures. */
function isWriting(sentence: string): boolean {
	const words = sentence.split(/\s+/).filter((word) => /\p{L}/u.test(word));
	const numbers = sentence.split(/\s+/).filter((word) => /\d/.test(word)).length;
	return (
		endsLikeASentence(sentence) &&
		words.length >= MIN_WORDS &&
		numbers * 3 <= words.length &&
		!/https?:\/\/|www\.|\S@\S+\.\S/.test(sentence) &&
		!isShouted(words) &&
		!isTitleCase(words)
	);
}

/** Ends with a period, question or exclamation mark, or ellipsis, maybe inside quotes or brackets. */
function endsLikeASentence(text: string): boolean {
	return /[.!?…]["”’)\]]*$/.test(text);
}

/** Mostly in capitals: a banner or a heading, “BREAKING NEWS: …”. */
function isShouted(words: readonly string[]): boolean {
	const capitals = words.filter((word) => /\p{L}{2}/u.test(word) && word === word.toUpperCase());
	return capitals.length * 2 > words.length;
}

/** Words this long or longer show title case: shorter ones (“to”, “for”) stay lowercase in titles. */
const TITLE_WORD = 4;

/** A headline: nearly every longer word capitalized, “Miss North Carolina Says She Never Approved”. */
function isTitleCase(words: readonly string[]): boolean {
	const long = words.filter((word) => word.replace(/\P{L}/gu, '').length >= TITLE_WORD);
	const capitalized = long.filter((word) => /^\P{L}*\p{Lu}/u.test(word));
	return long.length >= 3 && capitalized.length >= long.length * 0.8;
}
