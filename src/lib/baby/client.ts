import type { BabyEvent, BabyRequest, BabyResponse, BabyState, Reading, Turn } from './protocol.ts';

/** The app's view of Baby. */
export interface Baby {
	/** Replies to `prompt`, said after `history` (the conversation so far, oldest first). */
	reply(prompt: string, history?: readonly Turn[]): AsyncIterable<BabyEvent>;
	/**
	 * Reads, then practices on everything read so far. Aborting `signal` cancels it:
	 * it ends with `stopped`, unless it was finished.
	 */
	read(reading: Reading, signal?: AbortSignal): AsyncIterable<BabyEvent>;
	/** Forgets everything Baby has ever read, leaving a newborn that knows only its first word. */
	reset(): AsyncIterable<BabyEvent>;
	/** Brings back the model from before the latest reading, when `BabyState.undoable`. */
	undo(): AsyncIterable<BabyEvent>;
	/** Sends the whole model as a `file` event. */
	save(): AsyncIterable<BabyEvent>;
	/** Replaces the model with the one in `bytes`, a `.baby` file. */
	load(bytes: Uint8Array<ArrayBuffer>): AsyncIterable<BabyEvent>;
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
	const streams = new Map<string, (event: BabyEvent | Error) => void>();
	const listeners = new Set<(state: BabyState) => void>();
	let state: BabyState | undefined;

	endpoint.addEventListener('message', ({ data }) => {
		if (data.type === 'state') {
			state = data.state;
			for (const listener of listeners) listener(data.state);
			return;
		}
		if (data.type === 'error') {
			streams.get(data.id)?.(new Error(data.message));
			return;
		}
		const { id, ...event } = data;
		streams.get(id)?.(event);
	});

	/** The events for `request`; aborting `signal` asks the worker to cancel it. */
	async function* stream(
		request: (id: string) => BabyRequest,
		signal?: AbortSignal
	): AsyncGenerator<BabyEvent> {
		const id = crypto.randomUUID();
		const queue: (BabyEvent | Error)[] = [];
		let wake = () => {};
		const cancel = () => endpoint.postMessage({ type: 'cancel', id });

		streams.set(id, (event) => {
			queue.push(event);
			wake();
		});
		endpoint.postMessage(request(id));
		if (signal?.aborted) cancel();
		else signal?.addEventListener('abort', cancel, { once: true });

		try {
			for (;;) {
				const event = queue.shift();
				if (!event) {
					await new Promise<void>((resolve) => (wake = resolve));
					continue;
				}
				if (event instanceof Error) throw event;
				yield event;
				if (event.type === 'done' || event.type === 'stopped') return;
			}
		} finally {
			signal?.removeEventListener('abort', cancel);
			streams.delete(id);
		}
	}

	return {
		reply: (prompt, history = []) =>
			stream((id) => ({ type: 'reply', id, prompt, history: [...history] })),
		read: (reading, signal) => stream((id) => ({ type: 'read', id, reading }), signal),
		reset: () => stream((id) => ({ type: 'reset', id })),
		undo: () => stream((id) => ({ type: 'undo', id })),
		save: () => stream((id) => ({ type: 'save', id })),
		load: (bytes) => stream((id) => ({ type: 'load', id, bytes })),
		subscribe(listener) {
			listeners.add(listener);
			if (state) listener(state);
			return () => listeners.delete(listener);
		}
	};
}
