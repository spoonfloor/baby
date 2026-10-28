import { describe, expect, it } from 'vitest';
import type { Baby, BabyEvent, BabyState } from '#lib/baby/index.ts';
import type { Pack } from '#lib/library/index.ts';
import { Chat } from './chat.svelte.ts';

const pack: Pack = { id: 'abc', title: 'ABC', documents: [['a', 'b', 'c', '[EOS]']] };

/** A Baby that answers every request with `events`, then done, knowing `words`. */
function fakeBaby(events: BabyEvent[], words: string[]) {
	let release = () => {};
	const released = new Promise<void>((resolve) => (release = resolve));
	async function* respond(): AsyncGenerator<BabyEvent> {
		yield* events;
		await released;
		yield { type: 'done' };
	}
	const baby: Baby = {
		reply: respond,
		read: respond,
		subscribe(listener: (state: BabyState) => void) {
			listener({ words });
			return () => {};
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
	return { reply: respond, read: respond, subscribe: () => () => {} };
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
		await Promise.resolve();
		expect(chat.busy).toBe(true);

		release();
		await sending;

		expect(chat.busy).toBe(false);
		expect(chat.messages).toMatchObject([
			{ role: 'user', text: 'hello' },
			{ role: 'baby', text: 'moon spoon', status: 'Thinking', pending: false }
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

	it('shows reading as a Baby message with no user message, then marks the pack read', async () => {
		const { baby, release } = fakeBaby([{ type: 'status', text: 'Read 3 words' }], ['a']);
		const chat = new Chat(baby);

		const reading = chat.read(pack);
		await Promise.resolve();
		expect(chat.readPacks.has(pack.id)).toBe(false);

		release();
		await reading;

		expect(chat.messages).toMatchObject([
			{ role: 'baby', text: '', status: 'Read 3 words', pending: false }
		]);
		expect(chat.readPacks.has(pack.id)).toBe(true);
	});

	it('refuses new requests while Baby is busy', async () => {
		const { baby, release } = fakeBaby([], ['moon']);
		const chat = new Chat(baby);

		const sending = chat.send('one');
		await expect(chat.send('two')).rejects.toThrow();
		await expect(chat.read(pack)).rejects.toThrow();

		release();
		await sending;
	});

	it('ends a failed request instead of staying busy, and says so', async () => {
		const chat = new Chat(failingBaby());

		await chat.read(pack);

		expect(chat.busy).toBe(false);
		expect(chat.readPacks.has(pack.id)).toBe(false);
		expect(chat.messages).toMatchObject([
			{ role: 'baby', status: 'Thinking', pending: false },
			{ role: 'app', notice: 'failed' }
		]);
		await expect(chat.send('still there?')).resolves.toBeUndefined();
	});
});
