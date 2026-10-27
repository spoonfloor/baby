import { describe, expect, it } from 'vitest';
import type { Baby, BabyEvent } from '#lib/baby/index.ts';
import { Chat } from './chat.svelte.ts';

/** A Baby that replies with fixed events, waiting for `release` before finishing. */
function scriptedBaby(events: BabyEvent[]) {
	let release = () => {};
	const released = new Promise<void>((resolve) => (release = resolve));
	const baby: Baby = {
		async *reply() {
			yield* events;
			await released;
			yield { type: 'done' };
		}
	};
	return { baby, release };
}

describe('Chat', () => {
	it('adds the user message and builds Baby’s reply from events', async () => {
		const { baby, release } = scriptedBaby([
			{ type: 'status', text: 'Picking words' },
			{ type: 'token', text: 'moon' },
			{ type: 'token', text: ' spoon' }
		]);
		const chat = new Chat(baby);

		const sending = chat.send('hello');
		await Promise.resolve();
		expect(chat.busy).toBe(true);

		release();
		await sending;

		expect(chat.busy).toBe(false);
		expect(chat.messages).toMatchObject([
			{ role: 'user', text: 'hello' },
			{ role: 'baby', text: 'moon spoon', status: 'Picking words', pending: false }
		]);
	});

	it('refuses to send while Baby is replying', async () => {
		const { baby, release } = scriptedBaby([]);
		const chat = new Chat(baby);

		const sending = chat.send('one');
		await expect(chat.send('two')).rejects.toThrow();

		release();
		await sending;
	});
});
