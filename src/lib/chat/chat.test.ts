import { describe, expect, it } from 'vitest';
import type { Baby, BabyEvent, BabyState, ReplyTrace } from '#lib/baby/index.ts';
import type { Pack } from '#lib/library/index.ts';
import { Chat } from './chat.svelte.ts';

const pack: Pack = { id: 'abc', title: 'ABC', documents: [['a', 'b', 'c', '[EOS]']] };

/**
 * A Baby that answers every request with `events`, then done, knowing `words`.
 * Like the real one, it reports a finished reading’s source just before done.
 */
function fakeBaby(events: BabyEvent[], words: string[]) {
	let release = () => {};
	const released = new Promise<void>((resolve) => (release = resolve));
	const listeners = new Set<(state: BabyState) => void>();
	let state: BabyState = { words, sources: [] };
	async function* respond(source?: string): AsyncGenerator<BabyEvent> {
		yield* events;
		await released;
		if (source !== undefined) {
			state = { ...state, sources: [...state.sources, source] };
			for (const listener of listeners) listener(state);
		}
		yield { type: 'done' };
	}
	const baby: Baby = {
		reply: () => respond(),
		read: ({ source }) => respond(source),
		async *reset() {
			state = { words: [], sources: [] };
			for (const listener of listeners) listener(state);
			yield { type: 'done' };
		},
		subscribe(listener) {
			listeners.add(listener);
			listener(state);
			return () => listeners.delete(listener);
		}
	};
	return { baby, release };
}

/** A Baby whose every request fails partway, after one status. */
function failingBaby(): Baby {
	async function* respond(): AsyncGenerator<BabyEvent> {
		yield { type: 'status', text: 'Thinking' };
		throw new Error('Baby broke');
	}
	return { reply: respond, read: respond, reset: respond, subscribe: () => () => {} };
}

describe('Chat', () => {
	it('adds the user message and builds Baby’s reply from events', async () => {
		const { baby, release } = fakeBaby(
			[
				{ type: 'status', text: 'Thinking' },
				{ type: 'token', text: 'moon' },
				{ type: 'token', text: ' spoon' }
			],
			['moon', 'spoon']
		);
		const chat = new Chat(baby);

		const sending = chat.send('hello');
		expect(chat.replying).toBe(true);

		release();
		await sending;

		expect(chat.replying).toBe(false);
		expect(chat.messages).toMatchObject([
			{ role: 'user', text: 'hello' },
			{ role: 'baby', text: 'moon spoon', status: 'Thinking', pending: false }
		]);
	});

	it('keeps a reply’s trace on its message, and marks which request each message was', async () => {
		const trace: ReplyTrace = { prompt: ['hi'], unknown: [], context: ['hi'], stop: 'eos' };
		const { baby, release } = fakeBaby([{ type: 'trace', trace }], ['hi']);
		const chat = new Chat(baby);

		release();
		await chat.send('hi');
		await chat.read(pack);

		expect(chat.messages).toMatchObject([
			{ role: 'user' },
			{ role: 'baby', request: 'reply', trace },
			{ role: 'baby', request: 'read' }
		]);
	});

	it('adds the newborn notice when a Baby that knows nothing says nothing', async () => {
		const { baby, release } = fakeBaby([], []);
		const chat = new Chat(baby);

		release();
		await chat.send('Hi!');

		expect(chat.messages.map((message) => message.role)).toEqual(['user', 'baby', 'app']);
		expect(chat.messages.at(-1)).toMatchObject({ role: 'app', notice: 'newborn' });
	});

	it('adds no notice when a Baby that knows words happens to say nothing', async () => {
		const { baby, release } = fakeBaby([], ['moon']);
		const chat = new Chat(baby);

		release();
		await chat.send('Hi!');

		expect(chat.messages.map((message) => message.role)).toEqual(['user', 'baby']);
	});

	it('adds the unrecognized notice when most of the message was words Baby never read', async () => {
		const trace: ReplyTrace = {
			prompt: ['you', 'are', 'the', 'best'],
			unknown: ['the', 'best', 'are'],
			context: [],
			stop: 'eos'
		};
		const { baby, release } = fakeBaby(
			[
				{ type: 'token', text: 'hey' },
				{ type: 'trace', trace }
			],
			['you', 'hey']
		);
		const chat = new Chat(baby);

		release();
		await chat.send('You are the best');

		expect(chat.messages.at(-1)).toMatchObject({ role: 'app', notice: 'unrecognized' });
	});

	it('adds no notice when Baby knew at least half the message', async () => {
		const trace: ReplyTrace = {
			prompt: ['good', 'morning', 'to', 'you'],
			unknown: ['to'],
			context: [],
			stop: 'eos'
		};
		const { baby, release } = fakeBaby([{ type: 'trace', trace }], ['good', 'morning', 'you']);
		const chat = new Chat(baby);

		release();
		await chat.send('Good morning to you');

		expect(chat.messages.map((message) => message.role)).toEqual(['user', 'baby']);
	});

	it('shows reading as a Baby message with no user message, then marks the pack read', async () => {
		const { baby, release } = fakeBaby([{ type: 'status', text: 'Read 3 words' }], ['a']);
		const chat = new Chat(baby);

		const reading = chat.read(pack);
		await Promise.resolve();
		expect(chat.readPacks.includes(pack.id)).toBe(false);

		release();
		await reading;

		expect(chat.messages).toMatchObject([
			{ role: 'baby', text: '', status: 'Read 3 words', pending: false }
		]);
		expect(chat.readPacks.includes(pack.id)).toBe(true);
	});

	it('keeps a reading’s latest progress on its message', async () => {
		const { baby, release } = fakeBaby(
			[
				{ type: 'progress', done: 0, total: 200 },
				{ type: 'progress', done: 50, total: 200 }
			],
			['a']
		);
		const chat = new Chat(baby);

		const reading = chat.read(pack);
		release();
		await reading;

		expect(chat.messages).toMatchObject([{ role: 'baby', progress: { done: 50, total: 200 } }]);
	});

	it('refuses a second message while replying, and a second pack while reading', async () => {
		const { baby, release } = fakeBaby([], ['moon']);
		const chat = new Chat(baby);

		const sending = chat.send('one');
		const reading = chat.read(pack);
		await expect(chat.send('two')).rejects.toThrow();
		await expect(chat.read(pack)).rejects.toThrow();

		release();
		await Promise.all([sending, reading]);
	});

	it('chats while reading', async () => {
		const { baby, release } = fakeBaby([], ['moon']);
		const chat = new Chat(baby);

		const reading = chat.read(pack);
		expect(chat.reading).toBe(true);
		const sending = chat.send('still there?');
		expect(chat.replying).toBe(true);

		release();
		await Promise.all([reading, sending]);
		expect(chat.reading).toBe(false);
		expect(chat.replying).toBe(false);
	});

	it('ends a failed request instead of staying busy, and says so', async () => {
		const chat = new Chat(failingBaby());

		await chat.read(pack);

		expect(chat.reading).toBe(false);
		expect(chat.readPacks.includes(pack.id)).toBe(false);
		expect(chat.messages).toMatchObject([
			{ role: 'baby', status: 'Thinking', pending: false },
			{ role: 'app', notice: 'failed' }
		]);
		await expect(chat.send('still there?')).resolves.toBeUndefined();
	});

	it('resets: Baby forgets its reading and the conversation is cleared', async () => {
		const { baby, release } = fakeBaby([], ['a']);
		const chat = new Chat(baby);
		release();
		await chat.read(pack);
		await chat.send('hi');

		await chat.reset();

		expect(chat.messages).toEqual([]);
		expect(chat.readPacks).toEqual([]);
	});

	it('refuses to reset while Baby is busy', async () => {
		const { baby, release } = fakeBaby([], ['a']);
		const chat = new Chat(baby);

		const reading = chat.read(pack);
		await expect(chat.reset()).rejects.toThrow();

		release();
		await reading;
	});

	it('keeps the conversation and says so when a reset fails', async () => {
		const chat = new Chat(failingBaby());

		await chat.reset();

		expect(chat.messages).toMatchObject([{ role: 'app', notice: 'failed' }]);
	});
});
