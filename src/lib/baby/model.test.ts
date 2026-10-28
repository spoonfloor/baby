import { describe, expect, it } from 'vitest';
import { Model } from './model.ts';
import type { BabyEvent } from './protocol.ts';
import { seededRandom } from './random.ts';

const newModel = (seed = 1) => new Model({ random: seededRandom(seed), pause: async () => {} });

async function collect(events: AsyncIterable<BabyEvent>) {
	const collected: BabyEvent[] = [];
	for await (const event of events) collected.push(event);
	return collected;
}

const tokens = (events: BabyEvent[]) =>
	events.flatMap((event) => (event.type === 'token' ? [event.text] : []));

describe('Model', () => {
	it('is mute when brand new: no words, just status and done', async () => {
		const events = await collect(newModel().reply('Hi!'));

		expect(tokens(events)).toEqual([]);
		expect(events.at(-1)).toEqual({ type: 'done' });
		expect(events.filter((event) => event.type === 'status').length).toBeGreaterThan(1);
	});

	it('learns words by reading and reports what it read', async () => {
		const model = newModel();
		const events = await collect(model.read('the cow jumped over the moon'));

		expect(model.state).toEqual({ vocabularySize: 5 });
		expect(events.at(-2)).toEqual({
			type: 'status',
			text: 'Read “the cow jumped over the…”: 6 words, 5 new'
		});
		expect(events.at(-1)).toEqual({ type: 'done' });
	});

	it('after reading, replies only with words it has read', async () => {
		const model = newModel();
		await collect(model.read('the cow jumped over the moon'));
		const known = new Set(['the', 'cow', 'jumped', 'over', 'moon']);

		for (let attempt = 0; attempt < 20; attempt++) {
			const reply = tokens(await collect(model.reply('hello')));
			expect(reply.every((token) => known.has(token.trim()))).toBe(true);
		}
	});

	it('separates reply words with spaces inside the tokens', async () => {
		const model = newModel();
		await collect(model.read('a b c d e f g h i j k l m n o p'));

		// Baby may pick [EOS] early, so ask until it says at least two words.
		let reply: string[] = [];
		while (reply.length < 2) reply = tokens(await collect(model.reply('hello')));

		expect(reply[0]).not.toMatch(/^\s/);
		expect(reply.slice(1).every((token) => token.startsWith(' '))).toBe(true);
	});
});
