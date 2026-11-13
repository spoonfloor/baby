/**
 * The finished part of a draft: everything but a word still being typed. A word is
 * finished once a space or punctuation follows it, so “i am sa” is “i am” and
 * “i am sad.” is all of it. Trimmed.
 */
export function finishedPart(draft: string): string {
	// The same characters a word is made of in `tokenize`, the curly apostrophe included.
	return draft.replace(/[\p{L}\p{N}'’]+$/u, '').trim();
}
