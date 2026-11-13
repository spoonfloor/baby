import { describe, expect, it } from 'vitest';
import { Model } from './model.ts';
import type { BabyEvent, Reading, Turn } from './protocol.ts';
import { seededRandom } from './random.ts';
import { parseScripts } from './script.ts';
import type { TransformerConfig } from './transformer.ts';
import { tokenize } from './vocabulary.ts';

/** Small enough that practice takes moments. */
const SMALL: TransformerConfig = { dim: 16, layers: 2, heads: 2, hidden: 32, context: 16 };

const newModel = (seed = 1) =>
	new Model({ random: seededRandom(seed), idle: async () => {}, config: SMALL });

const rhyme: Reading = {
	source: 'rhyme',
	title: 'Rhyme',
	documents: [tokenize('the cow jumped over the moon')]
};
const hi: Reading = {
	source: 'hi',
	title: 'Hi',
	documents: parseScripts('you: Hi Baby!\nbaby: Hello there!')
};
const words = (text: string): Reading => ({
	source: text,
	title: text,
	documents: [tokenize(text)]
});

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
		const events = await collect(model.read(rhyme));

		expect(model.state).toEqual({
			words: ['the', 'cow', 'jumped', 'over', 'moon'],
			sources: ['rhyme']
		});
		expect(
			events.some((event) => event.type === 'status' && /^Practicing “Rhyme”/.test(event.text))
		).toBe(true);
		expect(events.at(-2)).toMatchObject({
			type: 'status',
			text: expect.stringMatching(
				/^Read “Rhyme”: 6 words · 5 new · loss \d\.\d\d → \d\.\d\d in \d+ of \d+ steps$/
			)
		});
		expect(events.at(-1)).toEqual({ type: 'done' });
	});

	it('shows practice against a budget set before it starts, with the time left', async () => {
		let clock = 0;
		const model = new Model({
			random: seededRandom(1),
			idle: async () => {},
			now: () => (clock += 1000),
			config: SMALL
		});
		const events = await collect(model.read(rhyme));
		const progress = events.flatMap((event) => (event.type === 'progress' ? [event] : []));

		expect(progress[0]).toEqual({ type: 'progress', done: 0, total: 200 });
		expect(progress.every(({ total }) => total === 200)).toBe(true);
		expect(progress.map(({ done }) => done)).toEqual(
			[...progress.map(({ done }) => done)].sort((a, b) => a - b)
		);
		expect(progress.at(-1)?.done).toBeLessThanOrEqual(200);
		expect(events).toContainEqual({
			type: 'status',
			text: expect.stringMatching(
				/^Practicing “Rhyme” · step 50 of 200 · about \d+ (seconds|minutes?) left$/
			)
		});
	});

	it('after reading, replies only with words it has read', async () => {
		const model = newModel();
		await collect(model.read(rhyme));
		const known = new Set(['the', 'cow', 'jumped', 'over', 'moon']);

		for (let attempt = 0; attempt < 20; attempt++) {
			const reply = tokens(await collect(model.reply('hello')));
			expect(reply.every((token) => known.has(token.trim()))).toBe(true);
		}
	});

	it('recites a memorized exchange, words separated by spaces inside the tokens', async () => {
		const model = newModel();
		await collect(model.read(hi));

		expect(tokens(await collect(model.reply('Hi Baby!')))).toEqual(['hello', ' there', ' !']);
	});

	it('guesses the first word of its reply: every word it can say, [UNK] left out', async () => {
		const model = newModel();
		await collect(model.read(hi));
		const events = await collect(model.guess('Hi Baby!'));

		const guessed = events.find((event) => event.type === 'guesses')?.guesses ?? [];
		const likeliest = guessed.reduce((best, guess) => (guess.chance > best.chance ? guess : best));
		const total = guessed.reduce((sum, { chance }) => sum + chance, 0);
		expect(guessed.map(({ word }) => word)).toEqual(
			expect.arrayContaining(['[EOS]', '[YOU]', '[BABY]', 'hello', 'there'])
		);
		expect(guessed.some(({ word }) => word === '[UNK]')).toBe(false);
		expect(total).toBeCloseTo(1, 5);
		expect(likeliest.word).toBe('hello');
		expect(events.at(-1)).toEqual({ type: 'done' });
	});

	it('traces a reply: what it saw, which words were unknown, and why it stopped', async () => {
		const model = newModel();
		await collect(model.read(hi));
		const events = await collect(model.reply('Hi shouls Baby, shouls!'));

		expect(events.at(-2)).toEqual({
			type: 'trace',
			trace: {
				prompt: ['hi', 'shouls', 'baby', ',', 'shouls', '!'],
				unknown: ['shouls', ','],
				context: ['[YOU]', 'hi', '[UNK]', 'baby', '[UNK]', '[UNK]', '!', '[EOS]', '[BABY]'],
				stop: 'eos'
			}
		});
	});

	it('sees the latest exchange before your message, opening on your turn', async () => {
		const model = new Model({
			random: seededRandom(1),
			idle: async () => {},
			config: { ...SMALL, context: 64 }
		});
		await collect(model.read(hi));
		const seen = async (history: Turn[]) => {
			const events = await collect(model.reply('Hi', history));
			const trace = events.find((event) => event.type === 'trace');
			return trace?.type === 'trace' ? trace.trace.context : [];
		};

		expect(
			await seen([
				{ speaker: 'you', text: 'Hi Baby!' },
				{ speaker: 'baby', text: 'hello there !' },
				{ speaker: 'you', text: 'Hi' },
				{ speaker: 'baby', text: 'hello' }
			])
		).toEqual([
			'[YOU]',
			'hi',
			'[EOS]',
			'[BABY]',
			'hello',
			'[EOS]',
			'[YOU]',
			'hi',
			'[EOS]',
			'[BABY]'
		]);
		// A reply with no message before it in view isn’t where a conversation opens.
		expect(await seen([{ speaker: 'baby', text: 'hello' }])).toEqual([
			'[YOU]',
			'hi',
			'[EOS]',
			'[BABY]'
		]);
	});

	it('ends a reply at a turn start, as if its turn were over', async () => {
		const model = newModel();
		// Hand-made, not a parsed script: Baby’s turn runs straight into the next one.
		await collect(
			model.read({
				source: 'run-on',
				title: 'Run-on',
				documents: [['[YOU]', 'hi', '[EOS]', '[BABY]', 'hello', '[YOU]']]
			})
		);
		const events = await collect(model.reply('hi'));

		expect(tokens(events)).toEqual(['hello']);
		expect(events.at(-2)).toMatchObject({ type: 'trace', trace: { stop: 'turn' } });
	});

	it('refuses to read two things at once', async () => {
		const model = newModel();
		const first = model.read(words('a b c'));
		await first.next();

		await expect(model.read(words('d e f')).next()).rejects.toThrow();
		await collect(first);
	});

	it('carries on from a snapshot exactly where it left off', async () => {
		const model = newModel();
		await collect(model.read(hi));
		const restored = new Model({
			random: seededRandom(1),
			idle: async () => {},
			config: SMALL,
			snapshot: model.snapshot()
		});

		expect(restored.state).toEqual(model.state);
		expect(tokens(await collect(restored.reply('Hi Baby!')))).toEqual(['hello', ' there', ' !']);
		expect(restored.snapshot()).toEqual(model.snapshot());
	});

	it('keeps reading after being restored, words keeping their ids', async () => {
		const model = newModel();
		await collect(model.read(hi));
		const restored = new Model({
			random: seededRandom(2),
			idle: async () => {},
			config: SMALL,
			snapshot: model.snapshot()
		});

		await collect(restored.read(rhyme));

		expect(restored.state.sources).toEqual(['hi', 'rhyme']);
		expect(restored.state.words.slice(0, model.state.words.length)).toEqual(model.state.words);
	});

	it('refuses a snapshot of a different size', async () => {
		const snapshot = newModel().snapshot();
		const options = { random: seededRandom(1), idle: async () => {}, snapshot };

		expect(() => new Model({ ...options, config: { ...SMALL, dim: 32 } })).toThrow();
	});
});
