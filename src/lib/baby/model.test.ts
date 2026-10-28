import { describe, expect, it } from 'vitest';
import { Model } from './model.ts';
import type { BabyEvent } from './protocol.ts';
import { seededRandom } from './random.ts';
import { parseScripts } from './script.ts';
import type { TransformerConfig } from './transformer.ts';
import { tokenize } from './vocabulary.ts';

/** Small enough that practice takes moments. */
const SMALL: TransformerConfig = { dim: 16, layers: 2, heads: 2, hidden: 32, context: 16 };

const newModel = (seed = 1) =>
	new Model({ random: seededRandom(seed), idle: async () => {}, config: SMALL });

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

	it('learns words by reading, practices, and reports both', async () => {
		const model = newModel();
		const events = await collect(model.read('Rhyme', [tokenize('the cow jumped over the moon')]));

		expect(model.state).toEqual({ words: ['the', 'cow', 'jumped', 'over', 'moon'] });
		expect(
			events.some((event) => event.type === 'status' && /^Practicing “Rhyme”/.test(event.text))
		).toBe(true);
		expect(events.at(-2)).toMatchObject({
			type: 'status',
			text: expect.stringMatching(
				/^Read “Rhyme”: 6 words · 5 new · loss \d\.\d\d → \d\.\d\d in \d+ steps$/
			)
		});
		expect(events.at(-1)).toEqual({ type: 'done' });
	});

	it('after reading, replies only with words it has read', async () => {
		const model = newModel();
		await collect(model.read('Rhyme', [tokenize('the cow jumped over the moon')]));
		const known = new Set(['the', 'cow', 'jumped', 'over', 'moon']);

		for (let attempt = 0; attempt < 20; attempt++) {
			const reply = tokens(await collect(model.reply('hello')));
			expect(reply.every((token) => known.has(token.trim()))).toBe(true);
		}
	});

	it('recites a memorized exchange, words separated by spaces inside the tokens', async () => {
		const model = newModel();
		await collect(model.read('Hi', parseScripts('you: Hi Baby!\nbaby: Hello there!')));

		expect(tokens(await collect(model.reply('Hi Baby!')))).toEqual(['hello', ' there', ' !']);
	});

	it('refuses to read two things at once', async () => {
		const model = newModel();
		const first = model.read('One', [tokenize('a b c')]);
		await first.next();

		await expect(model.read('Two', [tokenize('d e f')]).next()).rejects.toThrow();
		await collect(first);
	});
});
