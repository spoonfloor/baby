import type { Document } from './reading.ts';
import type { Speaker } from './script.ts';

/**
 * The seam between the app and the model. The app asks Baby to reply or to read,
 * and receives a stream of events for each request. Baby also pushes its state
 * whenever it changes. Any model behind this protocol (the untrained one now, the
 * WebGPU transformer later) can be swapped in without touching the UI.
 */

/**
 * One step of a request, in order: any number of `status`/`progress`/`token`, a
 * reply's one `trace` or a guess's one `guesses`, then one `done`.
 */
export type BabyEvent =
	| { type: 'status'; text: string } // what Baby is doing right now
	| { type: 'progress'; done: number; total: number } // how far through a known amount of work
	| { type: 'token'; text: string } // the next piece of a reply, whitespace included
	| { type: 'trace'; trace: ReplyTrace } // how a reply came about, for debugging
	| { type: 'guesses'; guesses: Guess[] } // the odds of each word Baby could say first
	| { type: 'done' };

/**
 * One word Baby could pick and the chance it would. Every word Baby can say has one,
 * markers included ([EOS], or a turn start, which end the reply before it starts);
 * the chances add up to 1.
 */
export interface Guess {
	word: string;
	chance: number;
}

/** How Baby arrived at a reply, recorded as it happened (Baby’s words change as it reads). */
export interface ReplyTrace {
	/** The message as Baby read it, word by word. */
	prompt: string[];
	/** Words in `prompt` Baby had never read, so saw as [UNK]; each once, in order. */
	unknown: string[];
	/**
	 * Exactly what Baby continued from: the latest turns of the conversation and the
	 * message, as a script, unknown words as [UNK].
	 */
	context: string[];
	/**
	 * Baby picked [EOS]; picked a turn start ([YOU] or [BABY]), thinking its turn was
	 * over; or reached the longest reply it will give.
	 */
	stop: 'eos' | 'turn' | 'limit';
}

/** One turn of the conversation so far, as it was said: yours, or Baby’s reply. */
export interface Turn {
	speaker: Speaker;
	text: string;
}

/** What Baby knows, for the app to react to (e.g. its notices, a reading preview). */
export interface BabyState {
	/** Every word Baby has read, not counting the special tokens. */
	words: string[];
	/** The `source` of every reading Baby has finished, each once. */
	sources: string[];
}

/** Something for Baby to read in one sitting. */
export interface Reading {
	/** Where it came from (a primer id), so the app can tell later what Baby has read. */
	source: string;
	/** Its name in status lines. */
	title: string;
	/** The exact tokens to train on. */
	documents: Document[];
}

/** App → worker. */
export type BabyRequest =
	/** `history` is the conversation before `prompt`, oldest first; Baby sees what fits of it. */
	| { type: 'reply'; id: string; prompt: string; history: Turn[] }
	/** Baby’s guesses at the first word of a reply to `prompt`, without replying. */
	| { type: 'guess'; id: string; prompt: string; history: Turn[] }
	| { type: 'read'; id: string; reading: Reading }
	/** Forgets everything, saved Baby included, leaving a newborn that knows only its first word. */
	| { type: 'reset'; id: string };

/**
 * Worker → app: an event tagged with its request, a request that failed (ending it
 * in place of `done`), or Baby's latest state.
 */
export type BabyResponse =
	| (BabyEvent & { id: string })
	| { type: 'error'; id: string; message: string }
	| { type: 'state'; state: BabyState };
