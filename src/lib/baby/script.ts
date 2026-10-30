import type { Document } from './reading.ts';
import { BABY, EOS, tokenize, UNK, YOU } from './vocabulary.ts';

/**
 * The conversation format: a script between two speakers who take turns. Each turn
 * is read as `[YOU] words [EOS]` or `[BABY] words [EOS]`, so the [BABY] marker (not
 * a question mark) is what tells Baby it’s its turn. The markers are tokens no text
 * can produce, so a reply that says “thank you” never looks like a new turn.
 */

export const SPEAKERS = ['you', 'baby'] as const;
export type Speaker = (typeof SPEAKERS)[number];

/** The marker that starts each speaker’s turn. */
export const TURN_START: Record<Speaker, string> = { you: YOU, baby: BABY };

/** One turn, as Baby reads it. */
const turn = (speaker: Speaker, words: string[]) => [TURN_START[speaker], ...words, EOS];

export function turnTokens(speaker: Speaker, text: string): string[] {
	return turn(speaker, tokenize(text));
}

/**
 * Parses conversations written one turn per line (`you: Hi Baby!`), with blank
 * lines between conversations. Each conversation becomes its own document.
 *
 * A lesson writes `[UNK]` in your turn for a word Baby will never know, to teach
 * what to do with one (“you: I hate [UNK].”). It reads as the [UNK] marker, exactly
 * as an unread word in a chat does. Baby’s own turns can’t have it: Baby never says
 * [UNK].
 */
export function parseScripts(source: string): Document[] {
	return source
		.trim()
		.split(/\n\s*\n/)
		.map((conversation) => conversation.trim().split('\n').flatMap(parseTurn));
}

function parseTurn(line: string): string[] {
	const colon = line.indexOf(':');
	const speaker = line.slice(0, colon).trim();
	if (colon < 0 || !isSpeaker(speaker)) throw new SyntaxError(`Not a script turn: ${line}`);
	const [first = '', ...rest] = line.slice(colon + 1).split(UNK);
	if (speaker === 'baby' && rest.length > 0)
		throw new SyntaxError(`Baby never says ${UNK}: ${line}`);
	const words = [...tokenize(first), ...rest.flatMap((part) => [UNK, ...tokenize(part)])];
	return turn(speaker, words);
}

function isSpeaker(name: string): name is Speaker {
	return (SPEAKERS as readonly string[]).includes(name);
}
