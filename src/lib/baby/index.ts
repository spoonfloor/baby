import { createBaby, type Baby } from './client.ts';

export type { Baby } from './client.ts';
export type { BabyEvent, BabyState } from './protocol.ts';
export type { Document } from './reading.ts';

/** Starts Baby in its own worker, keeping the model off the UI thread. */
export function spawnBaby(): Baby {
	return createBaby(
		new Worker(new URL('./worker/baby.worker.ts', import.meta.url), { type: 'module' })
	);
}
