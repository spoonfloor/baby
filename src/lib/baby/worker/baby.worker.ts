import { Model } from '../model.ts';
import type { BabyRequest, BabyResponse } from '../protocol.ts';
import { seededRandom } from '../random.ts';

const model = new Model({
	random: seededRandom(crypto.getRandomValues(new Uint32Array(1))[0] ?? 0),
	// A macrotask, not a microtask, so messages (a chat during practice) get handled.
	idle: () => new Promise((resolve) => setTimeout(resolve))
});

const post = (response: BabyResponse) => self.postMessage(response);

post({ type: 'state', state: model.state });

self.addEventListener('message', async ({ data: request }: MessageEvent<BabyRequest>) => {
	const events =
		request.type === 'reply'
			? model.reply(request.prompt)
			: model.read(request.title, request.documents);
	try {
		for await (const event of events) {
			// Publish any change to what Baby knows before the request finishes.
			if (event.type === 'done') post({ type: 'state', state: model.state });
			post({ ...event, id: request.id });
		}
	} catch (error) {
		post({ type: 'error', id: request.id, message: String(error) });
	}
});
