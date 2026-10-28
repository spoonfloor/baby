import type { Document } from './reading.ts';

/**
 * The seam between the app and the model. The app asks Baby to reply or to read,
 * and receives a stream of events for each request. Baby also pushes its state
 * whenever it changes. Any model behind this protocol (the untrained one now, the
 * WebGPU transformer later) can be swapped in without touching the UI.
 */

/**
 * One step of a request, in order: any number of `status`/`progress`/`token`, a
 * reply's one `trace`, then one `done`.
 */
export type BabyEvent =
	| { type: 'status'; text: string } // what Baby is doing right now
	| { type: 'progress'; done: number; total: number } // how far through a known amount of work
	| { type: 'token'; text: string } // the next piece of a reply, whitespace included
	| { type: 'trace'; trace: ReplyTrace } // how a reply came about, for debugging
	| { type: 'done' };

/** How Baby arrived at a reply, recorded as it happened (Baby’s words change as it reads). */
export interface ReplyTrace {
	/** The message as Baby read it, word by word. */
	prompt: string[];
	/** Words in `prompt` Baby had never read, so saw as [UNK]; each once, in order. */
	unknown: string[];
	/** Exactly what Baby continued from: the script around the message, unknown words as [UNK]. */
	context: string[];
	/**
	 * Baby picked [EOS]; picked a turn start ([YOU] or [BABY]), thinking its turn was
	 * over; or reached the longest reply it will give.
	 */
	stop: 'eos' | 'turn' | 'limit';
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
	/** Where it came from (a pack id), so the app can tell later what Baby has read. */
	source: string;
	/** Its name in status lines. */
	title: string;
	/** The exact tokens to train on. */
	documents: Document[];
}

/** App → worker. */
export type BabyRequest =
	| { type: 'reply'; id: string; prompt: string }
	| { type: 'read'; id: string; reading: Reading }
	/** Forgets everything, saved Baby included, leaving a blank model. */
	| { type: 'reset'; id: string };

/**
 * Worker → app: an event tagged with its request, a request that failed (ending it
 * in place of `done`), or Baby's latest state.
 */
export type BabyResponse =
	| (BabyEvent & { id: string })
	| { type: 'error'; id: string; message: string }
	| { type: 'state'; state: BabyState };
