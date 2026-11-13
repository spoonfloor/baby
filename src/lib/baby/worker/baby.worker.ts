import { firstWord } from '#lib/library/chatbot-101.ts';
import { Model, type ModelSnapshot } from '../model.ts';
import type { BabyEvent, BabyRequest, BabyResponse } from '../protocol.ts';
import { seededRandom } from '../random.ts';
import { clearSnapshot, loadSnapshot, saveSnapshot } from './storage.ts';

const post = (response: BabyResponse) => self.postMessage(response);

function createModel(snapshot?: ModelSnapshot): Model {
	return new Model({
		random: seededRandom(crypto.getRandomValues(new Uint32Array(1))[0] ?? 0),
		// A macrotask, not a microtask, so messages (a chat during practice) get handled.
		idle: () => new Promise((resolve) => setTimeout(resolve)),
		...(snapshot && { snapshot })
	});
}

/** A new Baby that has read its first word, saved so it reads it only once. */
async function newborn(): Promise<Model> {
	const model = createModel();
	const { id: source, title, documents } = firstWord;
	for await (const event of model.read({ source, title, documents })) void event;
	await saveSnapshot(model.snapshot());
	return model;
}

/** The saved Baby if there is one that fits, otherwise a newborn. */
async function start(): Promise<Model> {
	try {
		const snapshot = await loadSnapshot();
		if (snapshot) return createModel(snapshot);
	} catch (error) {
		console.warn('Starting a new Baby: the saved one couldn’t be restored.', error);
	}
	return newborn();
}

/** The current Baby; a reset swaps in a new one. */
let current = start().then((model) => {
	post({ type: 'state', state: model.state });
	return model;
});

/** Forgets the saved Baby, then starts over with a newborn. */
async function* reset(): AsyncGenerator<BabyEvent> {
	await clearSnapshot();
	const model = await newborn();
	current = Promise.resolve(model);
	post({ type: 'state', state: model.state });
	yield { type: 'done' };
}

self.addEventListener('message', async ({ data: request }: MessageEvent<BabyRequest>) => {
	try {
		const model = await current;
		const events =
			request.type === 'reply'
				? model.reply(request.prompt, request.history)
				: request.type === 'guess'
					? model.guess(request.prompt, request.history)
					: request.type === 'read'
						? model.read(request.reading)
						: reset();
		for await (const event of events) {
			if (event.type === 'done') {
				// Keep what Baby just learned, then publish it, before the request finishes.
				if (request.type === 'read') await saveSnapshot(model.snapshot());
				// A reset has already published its new Baby’s state; a guess changes nothing.
				if (request.type === 'read' || request.type === 'reply') {
					post({ type: 'state', state: model.state });
				}
			}
			post({ ...event, id: request.id });
		}
	} catch (error) {
		post({ type: 'error', id: request.id, message: String(error) });
	}
});
