/**
 * How Baby practices: over and over, it guesses each next word of random stretches
 * of everything it has read, until its guesses stop getting better.
 */

/** Steps averaged together before deciding whether practice is still paying off. */
const BLOCK_STEPS = 50;
/** A block must beat the best so far by this fraction to count as progress. */
const MIN_IMPROVEMENT = 0.02;
/** Blocks in a row without progress before Baby stops. */
const PATIENCE = 3;
/** Stops regardless, so practice always ends. */
const MAX_STEPS = 5000;

export interface Window {
	inputs: number[];
	/** The word after each input: what Baby should have guessed. */
	targets: number[];
}

/**
 * One step’s practice: windows from documents picked at random (longer ones more
 * often), until there are about `context` words to guess. Reading everything again,
 * not just the newest, is what keeps Baby from forgetting earlier lessons.
 *
 * A window never spans two documents, and one that fits starts at its beginning,
 * just as a chat does, so Baby learns that a conversation opens at the first word.
 * Longer documents give a random stretch.
 */
export function sampleBatch(
	documents: readonly (readonly number[])[],
	context: number,
	random: () => number
): Window[] {
	const usable = documents.filter((document) => document.length >= 2);
	const total = usable.reduce((sum, document) => sum + document.length, 0);
	if (total === 0) throw new RangeError('Need a document of at least two words to practice on');

	const windows: Window[] = [];
	let targets = 0;
	while (targets < context) {
		let remaining = random() * total;
		const document = usable.find((candidate) => (remaining -= candidate.length) < 0) ?? usable[0];
		if (!document) break;
		const length = Math.min(context, document.length - 1);
		const start = Math.floor(random() * (document.length - length));
		const stretch = document.slice(start, start + length + 1);
		windows.push({ inputs: stretch.slice(0, -1), targets: stretch.slice(1) });
		targets += length;
	}
	return windows;
}

/** Watches the loss step by step and says when it has stopped falling. */
export class Plateau {
	#steps = 0;
	#blockTotal = 0;
	#best = Infinity;
	#stalls = 0;
	/** The first and latest block averages, or undefined before the first block. */
	first: number | undefined;
	latest: number | undefined;

	get steps(): number {
		return this.#steps;
	}

	/** Whether this step finished a block, so there’s a new `latest` to report. */
	get blockEnded(): boolean {
		return this.#steps % BLOCK_STEPS === 0;
	}

	get reached(): boolean {
		return this.#stalls >= PATIENCE || this.#steps >= MAX_STEPS;
	}

	add(loss: number) {
		this.#steps++;
		this.#blockTotal += loss;
		if (!this.blockEnded) return;

		const average = this.#blockTotal / BLOCK_STEPS;
		this.#blockTotal = 0;
		this.first ??= average;
		this.latest = average;
		if (average < this.#best * (1 - MIN_IMPROVEMENT)) {
			this.#best = average;
			this.#stalls = 0;
		} else {
			this.#stalls++;
		}
	}
}
