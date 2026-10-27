/**
 * The seam between the app and the model. The app asks Baby for a reply and
 * receives a stream of events. The stub babbler and the real WebGPU model both
 * speak this protocol, so swapping one for the other never touches the UI.
 */

/** One step of a reply, in order: any number of `status`/`token`, then one `done`. */
export type BabyEvent =
	| { type: 'status'; text: string } // what Baby is doing right now
	| { type: 'token'; text: string } // the next piece of the reply, whitespace included
	| { type: 'done' };

/** App → worker. */
export type BabyRequest = { type: 'reply'; id: string; prompt: string };

/** Worker → app: an event, tagged with the request it belongs to. */
export type BabyResponse = BabyEvent & { id: string };
