import { Plateau, sampleBatch } from './practice.ts';
import type { BabyEvent, BabyState, Reading } from './protocol.ts';
import { count, describeReading, readingStats } from './reading.ts';
import { turnTokens } from './script.ts';
import {
	BABY_CONFIG,
	sameConfig,
	Transformer,
	type TransformerConfig,
	type TransformerSnapshot
} from './transformer.ts';
import { EOS_ID, tokenize, UNK_ID, Vocabulary } from './vocabulary.ts';

/**
 * Baby’s model: a vocabulary, everything it has read, and a transformer that
 * practices on it. Reading teaches new words and then practices until Baby’s
 * guesses stop improving; replying picks one word at a time from Baby’s guesses.
 * A brand-new Baby knows no words, so the only thing it can pick is [EOS]: it is mute.
 */

/** Longest reply Baby will give before stopping on its own. */
const MAX_REPLY_TOKENS = 40;

export interface ModelOptions {
	random: () => number;
	/** Lets other requests in between steps of work (chatting while Baby practices). */
	idle: () => Promise<void>;
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
	#practicing = false;

	constructor({ random, idle, config = BABY_CONFIG, snapshot }: ModelOptions) {
		this.#random = random;
		this.#idle = idle;
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

			const plateau = new Plateau();
			const context = this.#transformer.config.context;
			while (!plateau.reached) {
				plateau.add(this.#transformer.train(sampleBatch(this.#documents, context, this.#random)));
				if (plateau.blockEnded) {
					yield {
						type: 'status',
						text: `Practicing “${title}” · step ${plateau.steps} · loss ${formatLoss(plateau.latest)}`
					};
				}
				await this.#idle();
			}

			if (!this.#sources.includes(source)) this.#sources.push(source);
			yield {
				type: 'status',
				text: `Read “${title}”: ${describeReading(stats)} · loss ${formatLoss(plateau.first)} → ${formatLoss(plateau.latest)} in ${count(plateau.steps, 'step')}`
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

		// The script format: Baby sees `you : … [EOS] baby :` and continues from there.
		const ids = [...turnTokens('you', prompt), 'baby', ':'].map((word) =>
			this.#vocabulary.id(word)
		);
		const context = ids.map((id) => this.#vocabulary.word(id));
		let picked = 0;
		while (picked < MAX_REPLY_TOKENS) {
			await this.#idle();
			const id = this.#pick(this.#transformer.predict(ids));
			if (id === EOS_ID) break;
			ids.push(id);
			const word = this.#vocabulary.word(id);
			yield { type: 'token', text: picked === 0 ? word : ` ${word}` };
			picked++;
		}

		yield { type: 'status', text: this.#replySummary(picked) };
		yield {
			type: 'trace',
			trace: {
				prompt: words,
				unknown: [...new Set(unknown)],
				context,
				stop: picked < MAX_REPLY_TOKENS ? 'eos' : 'limit'
			}
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

	#replySummary(picked: number): string {
		if (this.#vocabulary.size === 0) return 'Looked for words to say but found none';
		if (picked === 0) return 'Picked [EOS] first, so said nothing';
		return `Picked ${count(picked, 'word')}, each a guess at what comes next`;
	}
}

/** Loss to two decimals, for status lines. */
function formatLoss(loss: number | undefined): string {
	return loss === undefined ? '–' : loss.toFixed(2);
}
