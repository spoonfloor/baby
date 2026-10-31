/**
 * How Baby practices: over and over, it guesses each next word of random stretches
 * of everything it has read, until its guesses stop getting better, it gets nearly
 * all of them right, or it reaches the budget set before it started.
 */

/** Steps averaged together before deciding whether practice is still paying off. */
const BLOCK_STEPS = 50;
/** A block must beat the best so far by this fraction to count as progress. */
const MIN_IMPROVEMENT = 0.02;
/**
 * Blocks in a row without progress before Baby stops. Practice on conversations
 * back to back is noisy, and at 3 it stopped Therapy Bot at about 1,500 steps while
 * its replies were still improving; 6 costs Chatbot 101 lessons up to 10 seconds
 * each (lab/log.md).
 */
const PATIENCE = 6;
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
/**
 * The fewest steps budgeted. A short reading, like a taught reply, ends here rather
 * than waiting out its patience, so teaching Baby a reply stays quick.
 */
const MIN_STEPS = BLOCK_STEPS * 4;
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

/**
 * Most documents read back to back in one window. Two is enough for Baby to answer
 * a message that follows an exchange; filling the whole window made each step about
 * twice as slow, and lessons learned worse in their budget (lab/log.md).
 */
export const CHAINED_DOCUMENTS = 2;

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
 * Documents that fit are read whole, from their first word, and up to
 * `CHAINED_DOCUMENTS` of them one after another in the same window, as a chat goes
 * on from one exchange to the next. So Baby learns to answer a message that follows
 * an earlier exchange: without this, every such reply was salad. Longer documents
 * give a random stretch of their own.
 */
export function sampleBatch(
	documents: readonly (readonly number[])[],
	context: number,
	random: () => number
): Window[] {
	const usable = documents.filter((document) => document.length >= 2);
	const total = usable.reduce((sum, document) => sum + document.length, 0);
	if (total === 0) throw new RangeError('Need a document of at least two words to practice on');

	const pick = () => {
		let remaining = random() * total;
		return usable.find((candidate) => (remaining -= candidate.length) < 0) ?? usable[0] ?? [];
	};

	const windows: Window[] = [];
	let targets = 0;
	while (targets < context) {
		const document = pick();
		let stretch: readonly number[];
		if (document.length > context + 1) {
			const start = Math.floor(random() * (document.length - context));
			stretch = document.slice(start, start + context + 1);
		} else {
			const chain = [...document];
			for (let chained = 1; chained < CHAINED_DOCUMENTS; chained++) {
				const next = pick();
				if (chain.length + next.length > context + 1) break;
				chain.push(...next);
			}
			stretch = chain;
		}
		windows.push({ inputs: stretch.slice(0, -1), targets: stretch.slice(1) });
		targets += stretch.length - 1;
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
