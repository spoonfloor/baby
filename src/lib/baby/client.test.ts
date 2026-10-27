import { afterEach, describe, expect, it } from 'vitest';
import { createBaby, type Endpoint } from './client.ts';
import type { BabyEvent, BabyRequest, BabyResponse } from './protocol.ts';

/** A fake worker on the far side of a real MessageChannel, replying with `script(prompt)`. */
function fakeWorker(script: (prompt: string) => BabyEvent[]) {
	const { port1, port2 } = new MessageChannel();
	port2.onmessage = ({ data: { id, prompt } }: MessageEvent<BabyRequest>) => {
		for (const event of script(prompt)) port2.postMessage({ ...event, id } satisfies BabyResponse);
	};
	port1.start();
	channels.push(port1, port2);
	return port1 as Endpoint;
}

const channels: MessagePort[] = [];
afterEach(() => channels.splice(0).forEach((port) => port.close()));

async function collect(stream: AsyncIterable<BabyEvent>) {
	const events: BabyEvent[] = [];
	for await (const event of stream) events.push(event);
	return events;
}

describe('createBaby', () => {
	it('yields the worker events for a reply, ending at done', async () => {
		const baby = createBaby(
			fakeWorker((prompt) => [
				{ type: 'status', text: 'thinking' },
				{ type: 'token', text: prompt },
				{ type: 'done' }
			])
		);

		expect(await collect(baby.reply('hi'))).toEqual([
			{ type: 'status', text: 'thinking' },
			{ type: 'token', text: 'hi' },
			{ type: 'done' }
		]);
	});

	it('keeps concurrent replies apart', async () => {
		const baby = createBaby(
			fakeWorker((prompt) => [{ type: 'token', text: prompt }, { type: 'done' }])
		);

		const [a, b] = await Promise.all([collect(baby.reply('a')), collect(baby.reply('b'))]);

		expect(a).toEqual([{ type: 'token', text: 'a' }, { type: 'done' }]);
		expect(b).toEqual([{ type: 'token', text: 'b' }, { type: 'done' }]);
	});
});
