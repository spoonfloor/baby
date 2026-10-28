import { describe, expect, it } from 'vitest';
import type { Baby, BabyEvent, BabyState } from '#lib/baby/index.ts';
import { Chat } from './chat.svelte.ts';

/** A Baby that answers every request with `events`, then done, knowing `vocabularySize` words. */
function fakeBaby(events: BabyEvent[], vocabularySize: number) {
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
			listener({ vocabularySize });
			return () => {};
		}
	};
	return { baby, release };
}

describe('Chat', () => {
	it('adds the user message and builds Baby’s reply from events', async () => {
		const { baby, release } = fakeBaby(
			[
				{ type: 'status', text: 'Thinking' },
				{ type: 'token', text: 'moon' },
				{ type: 'token', text: ' spoon' }
			],
			2
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
		const { baby, release } = fakeBaby([], 0);
		const chat = new Chat(baby);

		release();
		await chat.send('Hi!');

		expect(chat.messages.map((message) => message.role)).toEqual(['user', 'baby', 'app']);
		expect(chat.messages.at(-1)).toMatchObject({ role: 'app', notice: 'newborn' });
	});

	it('adds no notice when a Baby that knows words happens to say nothing', async () => {
		const { baby, release } = fakeBaby([], 5);
		const chat = new Chat(baby);

		release();
		await chat.send('Hi!');

		expect(chat.messages.map((message) => message.role)).toEqual(['user', 'baby']);
	});

	it('shows reading as a Baby message with no user message', async () => {
		const { baby, release } = fakeBaby([{ type: 'status', text: 'Read 3 words' }], 3);
		const chat = new Chat(baby);

		release();
		await chat.read('a b c');

		expect(chat.messages).toMatchObject([
			{ role: 'baby', text: '', status: 'Read 3 words', pending: false }
		]);
	});

	it('refuses new requests while Baby is busy', async () => {
		const { baby, release } = fakeBaby([], 1);
		const chat = new Chat(baby);

		const sending = chat.send('one');
		await expect(chat.send('two')).rejects.toThrow();
		await expect(chat.read('text')).rejects.toThrow();

		release();
		await sending;
	});
});
