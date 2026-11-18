import { describe, expect, it, vi } from 'vitest';
import type { Baby, BabyEvent, BabyState, Reading, ReplyTrace, Turn } from '#lib/baby/index.ts';
import { firstWord } from '#lib/library/chatbot-101.ts';
import type { Primer } from '#lib/library/index.ts';
import { GRAPH_WORDS } from '#lib/ui/guessMap.ts';
import { Chat } from './chat.svelte.ts';

const primer: Primer = { id: 'abc', title: 'ABC', documents: [['a', 'b', 'c', '[EOS]']] };

/** What a newborn has read: its first word. */
const born = [firstWord.id];
/** What a Baby that has started training has read. */
const trained = [firstWord.id, 'greetings'];

/**
 * A Baby that answers every request with `events`, then done, knowing `words` from
 * `sources`. Like the real one, it reports a finished reading’s source just before done.
 */
function fakeBaby(events: BabyEvent[], words: string[], sources: string[] = []) {
	let release = () => {};
	const released = new Promise<void>((resolve) => (release = resolve));
	const listeners = new Set<(state: BabyState) => void>();
	let state: BabyState = {
		words,
		sources: sources.map((id) => ({ id })),
		revision: 'r0',
		undoable: false
	};
	const publish = (next: Partial<BabyState>) => {
		state = { ...state, ...next };
		for (const listener of listeners) listener(state);
	};
	/** Each reply request: the message, and the conversation before it. */
	const asked: [prompt: string, history: readonly Turn[]][] = [];
	async function* respond(source?: string): AsyncGenerator<BabyEvent> {
		yield* events;
		await released;
		if (source !== undefined)
			publish({ sources: [...state.sources, { id: source }], undoable: true });
		yield { type: 'done' };
	}
	const baby: Baby = {
		reply: (prompt, history = []) => {
			asked.push([prompt, history]);
			return respond();
		},
		read: ({ source }) => respond(source),
		async *reset() {
			publish({ words: [], sources: [], undoable: false });
			yield { type: 'done' };
		},
		async *undo() {
			publish({ sources: state.sources.slice(0, -1), undoable: false });
			yield { type: 'done' };
		},
		async *save() {
			yield {
				type: 'file',
				bytes: new TextEncoder().encode(state.sources.map(({ id }) => id).join(','))
			};
			yield { type: 'done' };
		},
		async *load(bytes) {
			const sources = new TextDecoder().decode(bytes);
			if (sources === 'broken') throw new Error('Not a saved model');
			publish({ sources: sources.split(',').map((id) => ({ id })), undoable: false });
			yield { type: 'done' };
		},
		subscribe(listener) {
			listeners.add(listener);
			listener(state);
			return () => listeners.delete(listener);
		}
	};
	return { baby, release, asked };
}

/** A Baby whose every request fails partway, after one status. */
function failingBaby(): Baby {
	async function* respond(): AsyncGenerator<BabyEvent> {
		yield { type: 'status', text: 'Thinking' };
		throw new Error('Baby broke');
	}
	return {
		reply: respond,
		read: respond,
		reset: respond,
		undo: respond,
		save: respond,
		load: respond,
		subscribe: () => () => {}
	};
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

	it('keeps a finished reply word by word on its message: the odds at each word and the word picked', async () => {
		const odds = (word: string) => [{ word, chance: 1 }];
		const { baby, release } = fakeBaby(
			[
				{ type: 'guesses', guesses: odds('moon') },
				{ type: 'token', text: 'moon' },
				{ type: 'guesses', guesses: odds('[EOS]') }
			],
			['moon']
		);
		const chat = new Chat(baby);

		const sending = chat.send('hello');
		expect(chat.messages.at(-1)).not.toHaveProperty('steps');
		release();
		await sending;
		expect(chat.messages.at(-1)).toMatchObject({
			steps: [{ guesses: odds('moon'), picked: 'moon' }, { guesses: odds('[EOS]') }]
		});
	});

	it('keeps only the odds the Graph shows: the likeliest words, the word picked, and every marker', async () => {
		const tail = Array.from({ length: GRAPH_WORDS + 50 }, (_, index) => ({
			word: `w${index}`,
			chance: 1 / (index + 2)
		}));
		const guesses = [...tail, { word: '[YOU]', chance: 1e-9 }];
		const picked = `w${GRAPH_WORDS + 40}`;
		const { baby, release } = fakeBaby(
			[
				{ type: 'guesses', guesses },
				{ type: 'token', text: picked }
			],
			[picked]
		);
		const chat = new Chat(baby);
		release();
		await chat.send('hello');

		const message = chat.messages.at(-1);
		const kept = message?.role === 'baby' ? (message.steps?.[0]?.guesses ?? []) : [];
		// The word picked takes one of the Graph’s places; the marker is extra.
		expect(kept).toHaveLength(GRAPH_WORDS + 1);
		expect(kept.map(({ word }) => word)).toEqual(
			expect.arrayContaining(['w0', `w${GRAPH_WORDS - 2}`, picked, '[YOU]'])
		);
		expect(kept.map(({ word }) => word)).not.toContain(`w${GRAPH_WORDS - 1}`);
	});

	it('sends Baby the conversation before each message: your turns and its replies, not the app’s', async () => {
		const { baby, release, asked } = fakeBaby([{ type: 'token', text: 'hi' }], trained);
		release();
		const chat = new Chat(baby);
		await chat.send('Hello');
		chat.messages.push({ id: 'notice', role: 'app', notice: 'failed' });
		await chat.send('How are you?');

		expect(asked).toEqual([
			['Hello', []],
			[
				'How are you?',
				[
					{ speaker: 'you', text: 'Hello' },
					{ speaker: 'baby', text: 'hi' }
				]
			]
		]);
	});

	it('keeps a reply’s trace on its message, and marks which request each message was', async () => {
		const trace: ReplyTrace = { prompt: ['hi'], unknown: [], context: ['hi'], stop: 'eos' };
		const { baby, release } = fakeBaby([{ type: 'trace', trace }], ['hi']);
		const chat = new Chat(baby);

		release();
		await chat.send('hi');
		await chat.read(primer);

		expect(chat.messages).toMatchObject([
			{ role: 'user' },
			{ role: 'baby', request: 'reply', trace },
			{ role: 'baby', request: 'read' }
		]);
	});

	it('nudges toward training on turns 2, 3 and 6 while Baby knows only its first word', async () => {
		const { baby, release } = fakeBaby([{ type: 'token', text: 'hello' }], ['hello'], born);
		const chat = new Chat(baby);

		release();
		for (const text of ['Hi!', 'How are you?', 'Hm', 'Hm', 'Hm', 'Hm']) await chat.send(text);

		expect(
			chat.messages.flatMap((message) => (message.role === 'app' ? [message.notice] : []))
		).toEqual(['oneWord', 'guess', 'repertoire']);
		expect(chat.messages.slice(0, 3).map((message) => message.role)).toEqual([
			'user',
			'baby',
			'user'
		]);
	});

	it('stops nudging once Baby has read more than its first word', async () => {
		const { baby, release } = fakeBaby([{ type: 'token', text: 'hi' }], ['hello', 'hi'], trained);
		const chat = new Chat(baby);

		release();
		await chat.send('Hi!');
		await chat.send('Hi!');

		expect(chat.messages.map((message) => message.role)).toEqual(['user', 'baby', 'user', 'baby']);
	});

	it('points out a message Baby mostly couldn’t read, the first time only', async () => {
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
			['you', 'hey'],
			trained
		);
		const chat = new Chat(baby);

		release();
		await chat.send('You are the best');
		const notice = chat.messages.at(-1);
		expect(notice).toMatchObject({ role: 'app', notice: 'unrecognized' });
		expect(chat.teachable).toEqual({ prompt: 'You are the best', after: notice?.id });

		await chat.send('You are the best');
		expect(chat.messages.at(-1)).toMatchObject({ role: 'baby' });
	});

	it('adds no notice when Baby knew at least half the message', async () => {
		const trace: ReplyTrace = {
			prompt: ['good', 'morning', 'to', 'you'],
			unknown: ['to'],
			context: [],
			stop: 'eos'
		};
		const { baby, release } = fakeBaby(
			[{ type: 'trace', trace }],
			['good', 'morning', 'you'],
			trained
		);
		const chat = new Chat(baby);

		release();
		await chat.send('Good morning to you');

		expect(chat.messages.map((message) => message.role)).toEqual(['user', 'baby']);
	});

	it('shows reading as a Baby message with no user message, then marks the primer read', async () => {
		const { baby, release } = fakeBaby([{ type: 'status', text: 'Read 3 words' }], ['a']);
		const chat = new Chat(baby);

		const reading = chat.read(primer);
		await Promise.resolve();
		expect(chat.readSources.includes(primer.id)).toBe(false);

		release();
		await reading;

		expect(chat.messages).toMatchObject([
			{ role: 'baby', text: '', status: 'Read 3 words', pending: false }
		]);
		expect(chat.readSources.includes(primer.id)).toBe(true);
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

		const reading = chat.read(primer);
		release();
		await reading;

		expect(chat.messages).toMatchObject([{ role: 'baby', progress: { done: 50, total: 200 } }]);
	});

	it('refuses a second message while replying, and a second primer while reading', async () => {
		const { baby, release } = fakeBaby([], ['moon']);
		const chat = new Chat(baby);

		const sending = chat.send('one');
		const reading = chat.read(primer);
		await expect(chat.send('two')).rejects.toThrow();
		await expect(chat.read(primer)).rejects.toThrow();

		release();
		await Promise.all([sending, reading]);
	});

	it('chats while reading', async () => {
		const { baby, release } = fakeBaby([], ['moon']);
		const chat = new Chat(baby);

		const reading = chat.read(primer);
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

		await chat.read(primer);

		expect(chat.reading).toBe(false);
		expect(chat.readSources.includes(primer.id)).toBe(false);
		expect(chat.messages).toMatchObject([
			{ role: 'baby', status: 'Thinking', pending: false },
			{ role: 'app', notice: 'failed' }
		]);
		await expect(chat.send('still there?')).resolves.toBeUndefined();
	});

	it('offers to teach a reply to the latest finished reply, until something else is said', async () => {
		const { baby, release } = fakeBaby([{ type: 'token', text: 'hey' }], ['hey']);
		const chat = new Chat(baby);

		const sending = chat.send('IDK');
		expect(chat.teachable).toBeUndefined();
		release();
		await sending;
		const reply = chat.messages.at(-1);
		expect(chat.teachable).toEqual({ prompt: 'IDK', after: reply?.id });

		const reading = chat.read(primer);
		expect(chat.teachable).toBeUndefined();
		await reading;
		expect(chat.teachable).toBeUndefined();
	});

	it('teaches a reply: Baby reads the message and the reply as a script', async () => {
		const { baby, release } = fakeBaby([], ['hey']);
		const readings: Reading[] = [];
		const read = baby.read;
		baby.read = (reading) => {
			readings.push(reading);
			return read(reading);
		};
		const chat = new Chat(baby);
		release();
		await chat.send('IDK');

		chat.startTeaching();
		expect(chat.teaching).toBe('IDK');
		await chat.teach('Me too!');

		expect(chat.teaching).toBeUndefined();
		expect(chat.messages.slice(-2)).toMatchObject([
			{ role: 'user', text: 'Me too!', replyTo: 'IDK' },
			{ role: 'baby', request: 'read', pending: false }
		]);
		expect(readings).toHaveLength(1);
		expect(readings[0]?.documents).toEqual([
			['[YOU]', 'idk', '[EOS]', '[BABY]', 'me', 'too', '!', '[EOS]']
		]);
		expect(chat.readSources).toEqual([readings[0]?.source]);
	});

	it('offers Baby’s other clean replies as picks: new, distinct, at most three', async () => {
		const { baby, release, asked } = fakeBaby([], ['hey']);
		release();
		/** Each reply Baby gives in turn, and how it ended. */
		const replies: [string, ReplyTrace['stop']][] = [
			['Hello!', 'eos'], // to “hello”
			['Hey!', 'eos'], // to “What do you eat?”: the reply being taught over
			// The 8 attempts at picks:
			['Hey!', 'eos'], // the same again
			['I eat', 'limit'], // cut off
			['', 'eos'], // nothing
			['I eat words.', 'eos'],
			['I eat words.', 'eos'], // already offered
			['Thank you!', 'turn'], // ran into a new turn
			['Hi there!', 'eos'],
			['Bye!', 'eos'],
			// Never asked for: three picks were found.
			['Good night!', 'eos']
		];
		baby.reply = async function* (prompt, history = []) {
			asked.push([prompt, history]);
			const [text, stop] = replies.shift() ?? ['', 'eos'];
			if (text) yield { type: 'token', text };
			yield { type: 'trace', trace: { prompt: [], unknown: [], context: [], stop } };
			yield { type: 'done' };
		};
		const chat = new Chat(baby);
		await chat.send('hello');
		await chat.send('What do you eat?');

		chat.startTeaching();
		await vi.waitFor(() => expect(chat.picks).toHaveLength(3));

		expect(chat.picks).toEqual(['I eat words.', 'Hi there!', 'Bye!']);
		expect(asked).toHaveLength(2 + 8);
		// Asked the same message after the same conversation, not after the reply it replaces.
		expect(asked.at(-1)).toEqual([
			'What do you eat?',
			[
				{ speaker: 'you', text: 'hello' },
				{ speaker: 'baby', text: 'Hello!' }
			]
		]);
	});

	it('stops offering picks once teaching ends', async () => {
		const { baby, release, asked } = fakeBaby([{ type: 'token', text: 'Hey!' }], ['hey']);
		const chat = new Chat(baby);
		release();
		await chat.send('IDK');
		baby.reply = async function* (prompt, history = []) {
			asked.push([prompt, history]);
			yield { type: 'token', text: `Pick ${asked.length}` };
			yield { type: 'trace', trace: { prompt: [], unknown: [], context: [], stop: 'eos' } };
			yield { type: 'done' };
		};

		chat.startTeaching();
		chat.cancelTeaching();
		await vi.waitFor(() => expect(asked.length).toBeGreaterThan(1));

		expect(chat.picks).toEqual([]);
	});

	it('cancels teaching without saying anything', async () => {
		const { baby, release } = fakeBaby([], ['hey']);
		const chat = new Chat(baby);
		release();
		await chat.send('IDK');

		chat.startTeaching();
		chat.cancelTeaching();

		expect(chat.teaching).toBeUndefined();
		expect(chat.messages).toHaveLength(2);
		await expect(chat.teach('Me too!')).rejects.toThrow();
	});

	it('resets: Baby forgets its reading and the conversation is cleared', async () => {
		const { baby, release } = fakeBaby([], ['a']);
		const chat = new Chat(baby);
		release();
		await chat.read(primer);
		await chat.send('hi');

		await chat.reset();

		expect(chat.messages).toEqual([]);
		expect(chat.readSources).toEqual([]);
	});

	it('refuses to reset while Baby is busy', async () => {
		const { baby, release } = fakeBaby([], ['a']);
		const chat = new Chat(baby);

		const reading = chat.read(primer);
		await expect(chat.reset()).rejects.toThrow();

		release();
		await reading;
	});

	it('keeps the conversation and says so when a reset fails', async () => {
		const chat = new Chat(failingBaby());

		await chat.reset();

		expect(chat.messages).toMatchObject([{ role: 'app', notice: 'failed' }]);
	});

	it('undoes the latest reading, keeping the conversation and saying so', async () => {
		const { baby, release } = fakeBaby([], ['a'], born);
		const chat = new Chat(baby);
		release();
		await chat.read(primer);
		await chat.send('hi');
		const before = chat.messages.length;

		await chat.undo();

		expect(chat.readSources).toEqual(born);
		expect(chat.messages).toHaveLength(before + 1);
		expect(chat.messages.at(-1)).toMatchObject({ role: 'app', notice: 'undone' });
	});

	it('saves to a file and loads one back, clearing the conversation', async () => {
		const { baby, release } = fakeBaby([], ['a'], born);
		const chat = new Chat(baby);
		release();
		await chat.read(primer);
		const file = await chat.save();
		await chat.reset();
		await chat.send('hi');

		await chat.load(file);

		expect(chat.readSources).toEqual([...born, primer.id]);
		expect(chat.messages).toEqual([]);
		expect(chat.changing).toBe(false);
	});

	it('keeps the model and conversation when a load fails', async () => {
		const { baby, release } = fakeBaby([], ['a'], born);
		const chat = new Chat(baby);
		release();
		await chat.send('hi');

		await expect(chat.load(new TextEncoder().encode('broken'))).rejects.toThrow();

		expect(chat.readSources).toEqual(born);
		expect(chat.messages).toHaveLength(2);
		expect(chat.changing).toBe(false);
	});

	it('refuses to save, load, or undo while Baby is reading', async () => {
		const { baby, release } = fakeBaby([], ['a']);
		const chat = new Chat(baby);

		const reading = chat.read(primer);
		await expect(chat.save()).rejects.toThrow();
		await expect(chat.load(new Uint8Array())).rejects.toThrow();
		await expect(chat.undo()).rejects.toThrow();

		release();
		await reading;
	});
});
