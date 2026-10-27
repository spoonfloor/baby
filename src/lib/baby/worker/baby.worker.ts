import { babble } from '../babble.ts';
import type { BabyRequest, BabyResponse } from '../protocol.ts';
import { seededRandom } from '../random.ts';

const WORD_INTERVAL_MS = 120;

const random = seededRandom(crypto.getRandomValues(new Uint32Array(1))[0] ?? 0);
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, WORD_INTERVAL_MS));

self.addEventListener('message', async ({ data: { id, prompt } }: MessageEvent<BabyRequest>) => {
	for await (const event of babble(prompt, { random, pause })) {
		self.postMessage({ ...event, id } satisfies BabyResponse);
	}
});
