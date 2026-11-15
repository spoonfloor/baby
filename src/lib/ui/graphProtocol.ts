import type { ReplyStep } from '#lib/baby/index.ts';
import type { Ball, Point, Sizes } from './guessMap.ts';

/** The page ↔ Graph worker seam: lay out a reply, get back its balls, then each step’s places. */

/** Lay out the Graph of a reply, at these sizes. */
export interface GraphRequest {
	id: number;
	steps: ReplyStep[];
	sizes: Sizes;
}

export type GraphResponse =
	/** The balls at every step of the reply (see `toGraph`): sent first. */
	| { type: 'balls'; id: number; graph: Ball[][] }
	/** Where the balls rest at the next step, in order (see `layOut`). */
	| { type: 'places'; id: number; places: Map<string, Point> };
