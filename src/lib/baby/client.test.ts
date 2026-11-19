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
		text:
			request.type === 'reply'
				? request.prompt
				: request.type === 'read'
					? request.reading.title
					: 'reset'
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
		expect(await collect(baby.read({ source: 'moon', title: 'moon', documents: [] }))).toEqual([
			{ type: 'token', text: 'moon' },
			{ type: 'done' }
		]);
		expect(await collect(baby.reset())).toEqual([
			{ type: 'token', text: 'reset' },
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
				{
					type: 'state',
					state: { words: ['a', 'b', 'c'], sources: [], revision: 'r1', undoable: false }
				},
				{ id: request.id, type: 'done' }
			])
		);
		const early: BabyState[] = [];
		baby.subscribe((state) => early.push(state));

		await collect(baby.read({ source: 'x', title: 'x', documents: [] }));
		const late: BabyState[] = [];
		baby.subscribe((state) => late.push(state));

		const state = { words: ['a', 'b', 'c'], sources: [], revision: 'r1', undoable: false };
		expect(early).toEqual([state]);
		expect(late).toEqual([state]);
	});

	it('cancels a read when its signal aborts, ending at stopped', async () => {
		const requests: BabyRequest[] = [];
		const baby = createBaby(
			fakeWorker((request) => {
				requests.push(request);
				return request.type === 'cancel'
					? [{ id: request.id, type: 'stopped' }]
					: [{ id: request.id, type: 'status', text: 'Reading' }];
			})
		);
		const stop = new AbortController();
		const events: BabyEvent[] = [];

		for await (const event of baby.read({ source: 'x', title: 'x', documents: [] }, stop.signal)) {
			events.push(event);
			stop.abort();
		}

		const [read, cancel] = requests;
		expect(cancel).toEqual({ type: 'cancel', id: read?.id });
		expect(events).toEqual([{ type: 'status', text: 'Reading' }, { type: 'stopped' }]);
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
				for await (const event of baby.read({ source: 'x', title: 'x', documents: [] }))
					events.push(event);
			})()
		).rejects.toThrow('Baby broke');
		expect(events).toEqual([{ type: 'status', text: 'Reading' }]);
	});
});
