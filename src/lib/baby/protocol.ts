import type { Document } from './reading.ts';

/**
 * The seam between the app and the model. The app asks Baby to reply or to read,
 * and receives a stream of events for each request. Baby also pushes its state
 * whenever it changes. Any model behind this protocol (the untrained one now, the
 * WebGPU transformer later) can be swapped in without touching the UI.
 */

/** One step of a request, in order: any number of `status`/`token`, then one `done`. */
export type BabyEvent =
	| { type: 'status'; text: string } // what Baby is doing right now
	| { type: 'token'; text: string } // the next piece of a reply, whitespace included
	| { type: 'done' };

/** What Baby knows, for the app to react to (e.g. the Coach, a reading preview). */
export interface BabyState {
	/** Every word Baby has read, not counting the special tokens. */
	words: string[];
}

/** App → worker. */
export type BabyRequest =
	| { type: 'reply'; id: string; prompt: string }
	| { type: 'read'; id: string; title: string; documents: Document[] };

/**
 * Worker → app: an event tagged with its request, a request that failed (ending it
 * in place of `done`), or Baby's latest state.
 */
export type BabyResponse =
	| (BabyEvent & { id: string })
	| { type: 'error'; id: string; message: string }
	| { type: 'state'; state: BabyState };
