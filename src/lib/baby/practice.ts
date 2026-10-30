/**
 * How Baby practices: over and over, it guesses each next word of random stretches
 * of everything it has read, until its guesses stop getting better, it gets nearly
 * all of them right, or it reaches the budget set before it started.
 */

/** Steps averaged together before deciding whether practice is still paying off. */
const BLOCK_STEPS = 50;
/** A block must beat the best so far by this fraction to count as progress. */
const MIN_IMPROVEMENT = 0.02;
/** Blocks in a row without progress before Baby stops. */
const PATIENCE = 3;
/**
 * A block averaging under this loss means Baby guesses nearly every word right, so
 * it stops. Practicing on past that makes it certain, and certainty is hard to
 * unlearn: a Baby drilled on Hello alone then learned every lesson after it worse.
 */
const LEARNED_LOSS = 0.05;
/**
 * Practice steps budgeted per word read. Measured on Chatbot 101: readings of 190 to
 * 260 words stopped improving after 300 to 700 steps, so most finish before the budget.
 */
const STEPS_PER_WORD = 3;
/** The fewest steps budgeted: enough blocks for practice to notice it has stalled. */
const MIN_STEPS = BLOCK_STEPS * (PATIENCE + 1);
/** The most steps budgeted, however long the reading, so practice always ends soon enough. */
const MAX_STEPS = 5000;

/**
 * How many steps practicing on a reading of `words` words may take, set before it
 * starts so progress can be shown against it. Whole blocks, so the last one counts.
 */
export function practiceBudget(words: number): number {
	const blocks = Math.ceil((words * STEPS_PER_WORD) / BLOCK_STEPS);
	return Math.min(MAX_STEPS, Math.max(MIN_STEPS, blocks * BLOCK_STEPS));
}

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

/** Watches the loss step by step and says when it has stopped falling or used up its budget. */
export class Plateau {
	readonly budget: number;
	#steps = 0;
	#blockTotal = 0;
	#best = Infinity;
	#stalls = 0;
	#learned = false;
	/** The first and latest block averages, or undefined before the first block. */
	first: number | undefined;
	latest: number | undefined;

	constructor(budget: number) {
		this.budget = budget;
	}

	get steps(): number {
		return this.#steps;
	}

	/** Whether this step finished a block, so there’s a new `latest` to report. */
	get blockEnded(): boolean {
		return this.#steps % BLOCK_STEPS === 0;
	}

	get reached(): boolean {
		return this.#learned || this.#stalls >= PATIENCE || this.#steps >= this.budget;
	}

	add(loss: number) {
		this.#steps++;
		this.#blockTotal += loss;
		if (!this.blockEnded) return;

		const average = this.#blockTotal / BLOCK_STEPS;
		this.#blockTotal = 0;
		this.first ??= average;
		this.latest = average;
		this.#learned = average < LEARNED_LOSS;
		if (average < this.#best * (1 - MIN_IMPROVEMENT)) {
			this.#best = average;
			this.#stalls = 0;
		} else {
			this.#stalls++;
		}
	}
}
