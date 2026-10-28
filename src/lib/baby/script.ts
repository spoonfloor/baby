import type { Document } from './reading.ts';
import { BABY, EOS, tokenize, YOU } from './vocabulary.ts';

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
export function turnTokens(speaker: Speaker, text: string): string[] {
	return [TURN_START[speaker], ...tokenize(text), EOS];
}

/**
 * Parses conversations written one turn per line (`you: Hi Baby!`), with blank
 * lines between conversations. Each conversation becomes its own document.
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
	return turnTokens(speaker, line.slice(colon + 1));
}

function isSpeaker(name: string): name is Speaker {
	return (SPEAKERS as readonly string[]).includes(name);
}
