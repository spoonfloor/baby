import { describe, expect, it } from 'vitest';
import { babble } from './babble.ts';
import type { BabyEvent } from './protocol.ts';
import { seededRandom } from './random.ts';

async function collect(prompt: string, seed: number) {
	const events: BabyEvent[] = [];
	for await (const event of babble(prompt, { random: seededRandom(seed), pause: async () => {} })) {
		events.push(event);
	}
	return events;
}

describe('babble', () => {
	it('streams status, then words, then a final status and done', async () => {
		const events = await collect('hello there', 1);
		const types = events.map((event) => event.type);

		expect(types[0]).toBe('status');
		expect(types.at(-2)).toBe('status');
		expect(types.at(-1)).toBe('done');
		expect(types.slice(1, -2).every((type) => type === 'token')).toBe(true);
	});

	it('separates words with spaces inside the tokens', async () => {
		const tokens = (await collect('hello there', 2)).flatMap((event) =>
			event.type === 'token' ? [event.text] : []
		);

		expect(tokens[0]).not.toMatch(/^\s/);
		expect(tokens.slice(1).every((token) => token.startsWith(' '))).toBe(true);
	});

	it('is reproducible for a given seed', async () => {
		expect(await collect('hello there', 3)).toEqual(await collect('hello there', 3));
	});
});
