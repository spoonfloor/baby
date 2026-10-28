import { Model, type ModelSnapshot } from '../model.ts';
import type { BabyRequest, BabyResponse } from '../protocol.ts';
import { seededRandom } from '../random.ts';
import { loadSnapshot, saveSnapshot } from './storage.ts';

const post = (response: BabyResponse) => self.postMessage(response);

function createModel(snapshot?: ModelSnapshot): Model {
	return new Model({
		random: seededRandom(crypto.getRandomValues(new Uint32Array(1))[0] ?? 0),
		// A macrotask, not a microtask, so messages (a chat during practice) get handled.
		idle: () => new Promise((resolve) => setTimeout(resolve)),
		...(snapshot && { snapshot })
	});
}

/** The saved Baby if there is one that fits, otherwise a newborn. */
async function start(): Promise<Model> {
	try {
		const snapshot = await loadSnapshot();
		if (snapshot) return createModel(snapshot);
	} catch (error) {
		console.warn('Starting a new Baby: the saved one couldn’t be restored.', error);
	}
	return createModel();
}

const ready = start().then((model) => {
	post({ type: 'state', state: model.state });
	return model;
});

self.addEventListener('message', async ({ data: request }: MessageEvent<BabyRequest>) => {
	try {
		const model = await ready;
		const events =
			request.type === 'reply' ? model.reply(request.prompt) : model.read(request.reading);
		for await (const event of events) {
			if (event.type === 'done') {
				// Keep what Baby just learned, then publish it, before the request finishes.
				if (request.type === 'read') await saveSnapshot(model.snapshot());
				post({ type: 'state', state: model.state });
			}
			post({ ...event, id: request.id });
		}
	} catch (error) {
		post({ type: 'error', id: request.id, message: String(error) });
	}
});
