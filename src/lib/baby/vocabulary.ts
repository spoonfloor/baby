/** Stands in for any word Baby has never read. */
export const UNK = '[UNK]';
/** Marks the end of a document or reply. */
export const EOS = '[EOS]';

export const UNK_ID = 0;
export const EOS_ID = 1;
const SPECIAL_TOKENS = [UNK, EOS];

// Code, not copy: tokens use the straight apostrophe, so “don’t” and “don't” are one word.
// eslint-disable-next-line no-restricted-syntax
const APOSTROPHE = "'";

/** Splits text into word tokens: lowercase runs of letters, digits and apostrophes. */
export function tokenize(text: string): string[] {
	return (
		text
			.toLowerCase()
			.replaceAll('’', APOSTROPHE)
			.match(/[\p{L}\p{N}']+/gu) ?? []
	);
}

/** The words Baby knows, each with a numeric id. Starts with only the special tokens. */
export class Vocabulary {
	#words = [...SPECIAL_TOKENS];
	#ids = new Map(this.#words.map((word, id) => [word, id]));

	/** How many real words Baby knows, not counting the special tokens. */
	get size(): number {
		return this.#words.length - SPECIAL_TOKENS.length;
	}

	/** Ids of every real word, excluding the special tokens. */
	get wordIds(): number[] {
		return this.#words.map((_, id) => id).slice(SPECIAL_TOKENS.length);
	}

	/** Learns any words not seen before. Returns how many were new. */
	add(words: Iterable<string>): number {
		const before = this.#words.length;
		for (const word of words) {
			if (this.#ids.has(word)) continue;
			this.#ids.set(word, this.#words.length);
			this.#words.push(word);
		}
		return this.#words.length - before;
	}

	/** The id for `word`, or [UNK]'s id if Baby has never read it. */
	id(word: string): number {
		return this.#ids.get(word) ?? UNK_ID;
	}

	word(id: number): string {
		const word = this.#words[id];
		if (word === undefined) throw new RangeError(`No word with id ${id}`);
		return word;
	}
}
