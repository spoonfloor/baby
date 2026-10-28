import type { BabyEvent, BabyRequest, BabyResponse, BabyState } from './protocol.ts';

/** The app's view of Baby. */
export interface Baby {
	reply(prompt: string): AsyncIterable<BabyEvent>;
	read(text: string): AsyncIterable<BabyEvent>;
	/** Calls `listener` with Baby's state now (once known) and on every change. Returns an unsubscribe. */
	subscribe(listener: (state: BabyState) => void): () => void;
}

/** The part of a `Worker` the client uses. Tests substitute a `MessagePort`. */
export interface Endpoint {
	postMessage(request: BabyRequest): void;
	addEventListener(type: 'message', listener: (event: MessageEvent<BabyResponse>) => void): void;
}

/** Talks to a Baby running behind `endpoint`, routing each response to its request's stream. */
export function createBaby(endpoint: Endpoint): Baby {
	const streams = new Map<string, (event: BabyEvent) => void>();
	const listeners = new Set<(state: BabyState) => void>();
	let state: BabyState | undefined;

	endpoint.addEventListener('message', ({ data }) => {
		if (data.type === 'state') {
			state = data.state;
			for (const listener of listeners) listener(data.state);
			return;
		}
		const { id, ...event } = data;
		streams.get(id)?.(event);
	});

	async function* stream(request: (id: string) => BabyRequest): AsyncGenerator<BabyEvent> {
		const id = crypto.randomUUID();
		const queue: BabyEvent[] = [];
		let wake = () => {};

		streams.set(id, (event) => {
			queue.push(event);
			wake();
		});
		endpoint.postMessage(request(id));

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

	return {
		reply: (prompt) => stream((id) => ({ type: 'reply', id, prompt })),
		read: (text) => stream((id) => ({ type: 'read', id, text })),
		subscribe(listener) {
			listeners.add(listener);
			if (state) listener(state);
			return () => listeners.delete(listener);
		}
	};
}
