import type { BabyEvent, BabyState } from './protocol.ts';
import { count, describeReading, readingStats, type Document } from './reading.ts';
import { EOS_ID, tokenize, UNK_ID, Vocabulary } from './vocabulary.ts';

/**
 * Baby's model. For now it is untrained: it knows only the words it has read, and
 * every guess is a uniform pick among them and [EOS]. A brand-new Baby knows no
 * words, so the only thing it can pick is [EOS]: it is mute. The transformer will
 * replace the guessing later; the events stay the same.
 */

/** Longest reply Baby will give before stopping on its own. */
const MAX_REPLY_TOKENS = 40;

export interface ModelOptions {
	random: () => number;
	/** Called between steps, standing in for the time real work takes. */
	pause: () => Promise<void>;
}

export class Model {
	#vocabulary = new Vocabulary();
	#random: () => number;
	#pause: () => Promise<void>;

	constructor({ random, pause }: ModelOptions) {
		this.#random = random;
		this.#pause = pause;
	}

	get state(): BabyState {
		return { words: this.#vocabulary.words };
	}

	async *read(title: string, documents: Document[]): AsyncGenerator<BabyEvent> {
		yield { type: 'status', text: `Reading “${title}”` };
		await this.#pause();

		const stats = readingStats(documents, (word) => this.#vocabulary.has(word));
		this.#vocabulary.add(documents.flat());

		yield { type: 'status', text: `Read “${title}”: ${describeReading(stats)}` };
		yield { type: 'done' };
	}

	async *reply(prompt: string): AsyncGenerator<BabyEvent> {
		yield { type: 'status', text: 'Reading your message…' };
		await this.#pause();

		const ids = tokenize(prompt).map((word) => this.#vocabulary.id(word));
		const known = ids.filter((id) => id !== UNK_ID).length;
		yield { type: 'status', text: `Recognized ${known} of ${count(ids.length, 'word')}` };
		await this.#pause();

		const candidates = [EOS_ID, ...this.#vocabulary.wordIds];
		let picked = 0;
		while (picked < MAX_REPLY_TOKENS) {
			await this.#pause();
			const id = candidates[Math.floor(this.#random() * candidates.length)] ?? EOS_ID;
			if (id === EOS_ID) break;
			const word = this.#vocabulary.word(id);
			yield { type: 'token', text: picked === 0 ? word : ` ${word}` };
			picked++;
		}

		yield { type: 'status', text: this.#replySummary(picked) };
		yield { type: 'done' };
	}

	#replySummary(picked: number): string {
		if (this.#vocabulary.size === 0) return 'Looked for words to say but found none';
		if (picked === 0) return 'Picked [EOS] first, so said nothing';
		return `Picked ${count(picked, 'word')} at random, without knowing how to use them`;
	}
}
