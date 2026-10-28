import { afterEach, describe, expect, it } from 'vitest';
import { createBaby, type Endpoint } from './client.ts';
import type { BabyEvent, BabyRequest, BabyResponse, BabyState } from './protocol.ts';

const ports: MessagePort[] = [];
afterEach(() => ports.splice(0).forEach((port) => port.close()));

/** A fake worker on the far side of a real MessageChannel. */
function fakeWorker(script: (request: BabyRequest) => BabyResponse[]) {
	const { port1, port2 } = new MessageChannel();
	port2.onmessage = ({ data }: MessageEvent<BabyRequest>) => {
		for (const response of script(data)) port2.postMessage(response);
	};
	port1.start();
	ports.push(port1, port2);
	return port1 as Endpoint;
}

const echo = (request: BabyRequest): BabyResponse[] => [
	{
		id: request.id,
		type: 'token',
		text: request.type === 'reply' ? request.prompt : request.title
	},
	{ id: request.id, type: 'done' }
];

async function collect(stream: AsyncIterable<BabyEvent>) {
	const events: BabyEvent[] = [];
	for await (const event of stream) events.push(event);
	return events;
}

describe('createBaby', () => {
	it('streams the events for a request, ending at done', async () => {
		const baby = createBaby(fakeWorker(echo));

		expect(await collect(baby.reply('hi'))).toEqual([
			{ type: 'token', text: 'hi' },
			{ type: 'done' }
		]);
		expect(await collect(baby.read('moon', []))).toEqual([
			{ type: 'token', text: 'moon' },
			{ type: 'done' }
		]);
	});

	it('keeps concurrent requests apart', async () => {
		const baby = createBaby(fakeWorker(echo));

		const [a, b] = await Promise.all([collect(baby.reply('a')), collect(baby.reply('b'))]);

		expect(a).toEqual([{ type: 'token', text: 'a' }, { type: 'done' }]);
		expect(b).toEqual([{ type: 'token', text: 'b' }, { type: 'done' }]);
	});

	it('passes state updates to subscribers, including late ones', async () => {
		const baby = createBaby(
			fakeWorker((request) => [
				{ type: 'state', state: { words: ['a', 'b', 'c'] } },
				{ id: request.id, type: 'done' }
			])
		);
		const early: BabyState[] = [];
		baby.subscribe((state) => early.push(state));

		await collect(baby.read('x', []));
		const late: BabyState[] = [];
		baby.subscribe((state) => late.push(state));

		expect(early).toEqual([{ words: ['a', 'b', 'c'] }]);
		expect(late).toEqual([{ words: ['a', 'b', 'c'] }]);
	});

	it('fails the stream when Baby reports an error', async () => {
		const baby = createBaby(
			fakeWorker((request) => [
				{ id: request.id, type: 'status', text: 'Reading' },
				{ id: request.id, type: 'error', message: 'Baby broke' }
			])
		);
		const events: BabyEvent[] = [];

		await expect(
			(async () => {
				for await (const event of baby.read('x', [])) events.push(event);
			})()
		).rejects.toThrow('Baby broke');
		expect(events).toEqual([{ type: 'status', text: 'Reading' }]);
	});
});
