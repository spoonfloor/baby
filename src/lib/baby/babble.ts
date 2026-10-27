import type { BabyEvent } from './protocol.ts';

/**
 * Stand-in for the real model: replies with random words, the way an untrained
 * Baby would. Replaced by the WebGPU model later; the events it yields stay the same.
 */

const STARTER_WORDS = ['the', 'a', 'and', 'baby', 'moon', 'cow', 'jumped', 'over', 'spoon', 'star'];

export interface BabbleOptions {
	random: () => number;
	/** Called between steps and words, standing in for the time real work takes. */
	pause: () => Promise<void>;
}

export async function* babble(
	prompt: string,
	{ random, pause }: BabbleOptions
): AsyncGenerator<BabyEvent> {
	yield { type: 'status', text: 'Reading your message…' };
	await pause();
	yield { type: 'status', text: 'Picking random words…' };

	const vocabulary = [...STARTER_WORDS, ...(prompt.toLowerCase().match(/[\p{L}']+/gu) ?? [])];
	const count = 4 + Math.floor(random() * 12);

	for (let i = 0; i < count; i++) {
		await pause();
		const word = vocabulary[Math.floor(random() * vocabulary.length)] ?? '';
		yield { type: 'token', text: i === 0 ? word : ` ${word}` };
	}

	yield { type: 'status', text: `Picked ${count} random words. Baby hasn't read anything yet.` };
	yield { type: 'done' };
}
