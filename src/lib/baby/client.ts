import type { BabyEvent, BabyRequest, BabyResponse } from './protocol.ts';

/** The app's view of Baby. */
export interface Baby {
	reply(prompt: string): AsyncIterable<BabyEvent>;
}

/** The part of a `Worker` the client uses. Tests substitute a `MessagePort`. */
export interface Endpoint {
	postMessage(request: BabyRequest): void;
	addEventListener(type: 'message', listener: (event: MessageEvent<BabyResponse>) => void): void;
}

/** Talks to a Baby running behind `endpoint`, routing each response to its request's stream. */
export function createBaby(endpoint: Endpoint): Baby {
	const streams = new Map<string, (event: BabyEvent) => void>();

	endpoint.addEventListener('message', ({ data: { id, ...event } }) => {
		streams.get(id)?.(event);
	});

	return {
		async *reply(prompt) {
			const id = crypto.randomUUID();
			const queue: BabyEvent[] = [];
			let wake = () => {};

			streams.set(id, (event) => {
				queue.push(event);
				wake();
			});
			endpoint.postMessage({ type: 'reply', id, prompt });

			try {
				for (;;) {
					const event = queue.shift();
					if (!event) {
						await new Promise<void>((resolve) => (wake = resolve));
						continue;
					}
					yield event;
					if (event.type === 'done') return;
				}
			} finally {
				streams.delete(id);
			}
		}
	};
}
