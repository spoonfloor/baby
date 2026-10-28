import { Plateau, practiceBudget, sampleBatch } from './practice.ts';
import type { BabyEvent, BabyState, Reading, ReplyTrace } from './protocol.ts';
import { count, describeReading, readingStats } from './reading.ts';
import { TURN_START, turnTokens } from './script.ts';
import {
	BABY_CONFIG,
	sameConfig,
	Transformer,
	type TransformerConfig,
	type TransformerSnapshot
} from './transformer.ts';
import { EOS, EOS_ID, isSpecial, tokenize, UNK_ID, Vocabulary } from './vocabulary.ts';

/**
 * Baby’s model: a vocabulary, everything it has read, and a transformer that
 * practices on it. Reading teaches new words and then practices until Baby’s
 * guesses stop improving; replying picks one word at a time from Baby’s guesses.
 * A brand-new Baby knows no words, so all it can pick is a marker that ends its turn: it is mute.
 */

/** Longest reply Baby will give before stopping on its own. */
const MAX_REPLY_TOKENS = 40;

export interface ModelOptions {
	random: () => number;
	/** Lets other requests in between steps of work (chatting while Baby practices). */
	idle: () => Promise<void>;
	/** Milliseconds from any fixed start, for estimating how long practice has left. */
	now?: () => number;
	config?: TransformerConfig;
	/** A Baby saved earlier, to carry on from. Must match `config`. */
	snapshot?: ModelSnapshot;
}

/** Everything Baby is, as plain data to store and restore. */
export interface ModelSnapshot {
	/** Real words in id order, so restoring gives every word its old id. */
	words: string[];
	documents: number[][];
	sources: string[];
	transformer: TransformerSnapshot;
}

export class Model {
	#vocabulary = new Vocabulary();
	/** Everything Baby has read, as word ids, one array per document. */
	#documents: number[][] = [];
	/** The `source` of every finished reading, each once. */
	#sources: string[] = [];
	#transformer: Transformer;
	#random: () => number;
	#idle: () => Promise<void>;
	#now: () => number;
	#practicing = false;

	constructor({
		random,
		idle,
		now = () => performance.now(),
		config = BABY_CONFIG,
		snapshot
	}: ModelOptions) {
		this.#random = random;
		this.#idle = idle;
		this.#now = now;
		if (!snapshot) {
			this.#transformer = new Transformer(config, this.#vocabulary.tokenCount, random);
			return;
		}
		if (!sameConfig(snapshot.transformer.config, config)) {
			throw new RangeError('Snapshot is of a Baby with a different size');
		}
		this.#vocabulary.add(snapshot.words);
		if (snapshot.transformer.vocabularySize !== this.#vocabulary.tokenCount) {
			throw new RangeError('Snapshot’s words don’t match its numbers');
		}
		this.#documents = snapshot.documents.map((document) => [...document]);
		this.#sources = [...snapshot.sources];
		this.#transformer = Transformer.restore(snapshot.transformer, random);
	}

	get state(): BabyState {
		return { words: this.#vocabulary.words, sources: [...this.#sources] };
	}

	/** A copy of everything Baby is right now. */
	snapshot(): ModelSnapshot {
		return {
			words: this.#vocabulary.words,
			documents: this.#documents.map((document) => [...document]),
			sources: [...this.#sources],
			transformer: this.#transformer.snapshot()
		};
	}

	async *read({ source, title, documents }: Reading): AsyncGenerator<BabyEvent> {
		if (this.#practicing) throw new Error('Baby is already reading');
		this.#practicing = true;
		try {
			yield { type: 'status', text: `Reading “${title}”` };
			await this.#idle();

			const stats = readingStats(documents, (word) => this.#vocabulary.has(word));
			this.#vocabulary.add(documents.flat());
			this.#transformer.growVocabulary(this.#vocabulary.tokenCount);
			for (const document of documents) {
				this.#documents.push(document.map((word) => this.#vocabulary.id(word)));
			}

			const plateau = new Plateau(practiceBudget(stats.words));
			const context = this.#transformer.config.context;
			const started = this.#now();
			yield { type: 'status', text: `Practicing “${title}”` };
			yield { type: 'progress', done: 0, total: plateau.budget };
			while (!plateau.reached) {
				plateau.add(this.#transformer.train(sampleBatch(this.#documents, context, this.#random)));
				if (plateau.blockEnded) {
					const perStep = (this.#now() - started) / plateau.steps;
					const left = (plateau.budget - plateau.steps) * perStep;
					yield {
						type: 'status',
						text: `Practicing “${title}” · step ${plateau.steps} of ${plateau.budget} · ${timeLeft(left)}`
					};
					yield { type: 'progress', done: plateau.steps, total: plateau.budget };
				}
				await this.#idle();
			}

			if (!this.#sources.includes(source)) this.#sources.push(source);
			yield {
				type: 'status',
				text: `Read “${title}”: ${describeReading(stats)} · loss ${formatLoss(plateau.first)} → ${formatLoss(plateau.latest)} in ${plateau.steps} of ${count(plateau.budget, 'step')}`
			};
			yield { type: 'done' };
		} finally {
			this.#practicing = false;
		}
	}

	async *reply(prompt: string): AsyncGenerator<BabyEvent> {
		yield { type: 'status', text: 'Reading your message…' };
		await this.#idle();

		const words = tokenize(prompt);
		const unknown = words.filter((word) => !this.#vocabulary.has(word));
		yield {
			type: 'status',
			text: `Recognized ${words.length - unknown.length} of ${count(words.length, 'word')}`
		};

		// The script format: Baby sees `[YOU] … [EOS] [BABY]` and continues from there.
		const ids = [...turnTokens('you', prompt), TURN_START.baby].map((word) =>
			this.#vocabulary.id(word)
		);
		const context = ids.map((id) => this.#vocabulary.word(id));
		let picked = 0;
		let stop: ReplyTrace['stop'] = 'limit';
		let marker: string | undefined;
		while (picked < MAX_REPLY_TOKENS) {
			await this.#idle();
			const word = this.#vocabulary.word(this.#pick(this.#transformer.predict(ids)));
			// A marker ends the reply: [EOS], or a turn start, where Baby thinks the turn is over.
			if (isSpecial(word)) {
				stop = word === EOS ? 'eos' : 'turn';
				marker = word;
				break;
			}
			ids.push(this.#vocabulary.id(word));
			yield { type: 'token', text: picked === 0 ? word : ` ${word}` };
			picked++;
		}

		yield { type: 'status', text: this.#replySummary(picked, marker) };
		yield {
			type: 'trace',
			trace: { prompt: words, unknown: [...new Set(unknown)], context, stop }
		};
		yield { type: 'done' };
	}

	/**
	 * Samples a word id in proportion to Baby’s guesses. [UNK] is only ever an input
	 * (a word Baby hasn’t read), never something Baby can say.
	 */
	#pick(probabilities: Float32Array): number {
		let total = 0;
		probabilities.forEach((p, id) => {
			if (id !== UNK_ID) total += p;
		});
		let remaining = this.#random() * total;
		let picked = EOS_ID;
		probabilities.forEach((p, id) => {
			if (id === UNK_ID || remaining <= 0) return;
			remaining -= p;
			picked = id;
		});
		return picked;
	}

	#replySummary(picked: number, marker: string | undefined): string {
		if (this.#vocabulary.size === 0) return 'Looked for words to say but found none';
		if (picked === 0) return `Picked ${marker ?? EOS} first, so said nothing`;
		return `Picked ${count(picked, 'word')}, each a guess at what comes next`;
	}
}

/**
 * “About 25 seconds left”, “about 3 minutes left”: an estimate, so rounded up to 5
 * seconds or to the nearest minute.
 */
function timeLeft(milliseconds: number): string {
	const seconds = milliseconds / 1000;
	if (seconds < 60) return `about ${count(Math.max(5, Math.ceil(seconds / 5) * 5), 'second')} left`;
	return `about ${count(Math.round(seconds / 60), 'minute')} left`;
}

/** Loss to two decimals, for status lines. */
function formatLoss(loss: number | undefined): string {
	return loss === undefined ? '–' : loss.toFixed(2);
}
