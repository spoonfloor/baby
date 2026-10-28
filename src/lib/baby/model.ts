import { Plateau, sampleBatch } from './practice.ts';
import type { BabyEvent, BabyState } from './protocol.ts';
import { count, describeReading, readingStats, type Document } from './reading.ts';
import { turnTokens } from './script.ts';
import { BABY_CONFIG, Transformer, type TransformerConfig } from './transformer.ts';
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
}

export class Model {
	#vocabulary = new Vocabulary();
	/** Everything Baby has read, as word ids, one array per document. */
	#documents: number[][] = [];
	#transformer: Transformer;
	#random: () => number;
	#idle: () => Promise<void>;
	#practicing = false;

	constructor({ random, idle, config = BABY_CONFIG }: ModelOptions) {
		this.#random = random;
		this.#idle = idle;
		this.#transformer = new Transformer(config, this.#vocabulary.tokenCount, random);
	}

	get state(): BabyState {
		return { words: this.#vocabulary.words };
	}

	async *read(title: string, documents: Document[]): AsyncGenerator<BabyEvent> {
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

		const words = tokenize(prompt).map((word) => this.#vocabulary.id(word));
		const known = words.filter((id) => id !== UNK_ID).length;
		yield { type: 'status', text: `Recognized ${known} of ${count(words.length, 'word')}` };

		// The script format: Baby sees `you : … [EOS] baby :` and continues from there.
		const ids = [...turnTokens('you', prompt), 'baby', ':'].map((word) =>
			this.#vocabulary.id(word)
		);
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
