import { Model } from '../model.ts';
import type { BabyRequest, BabyResponse } from '../protocol.ts';
import { seededRandom } from '../random.ts';

const STEP_INTERVAL_MS = 120;

const model = new Model({
	random: seededRandom(crypto.getRandomValues(new Uint32Array(1))[0] ?? 0),
	pause: () => new Promise((resolve) => setTimeout(resolve, STEP_INTERVAL_MS))
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
