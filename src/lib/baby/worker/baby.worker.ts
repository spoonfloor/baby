import { firstWord } from '#lib/library/chatbot-101.ts';
import { Model, type ModelSnapshot } from '../model.ts';
import type { BabyEvent, BabyRequest, BabyResponse, Reading } from '../protocol.ts';
import { seededRandom } from '../random.ts';
import { decodeSave, encodeSave } from '../saveFile.ts';
import { clear, keep, load } from './storage.ts';

const post = (response: BabyResponse) => self.postMessage(response);

/** The model and the revision naming it (see `BabyState.revision`). */
interface Current {
	model: Model;
	revision: string;
}

function createModel(snapshot?: ModelSnapshot): Model {
	return new Model({
		random: seededRandom(crypto.getRandomValues(new Uint32Array(1))[0] ?? 0),
		// A macrotask, not a microtask, so messages (a chat during practice) get handled.
		idle: () => new Promise((resolve) => setTimeout(resolve)),
		...(snapshot && { snapshot })
	});
}

/** A new Baby that has read its first word, saved so it reads it only once. */
async function newborn(): Promise<Current> {
	const model = createModel();
	const { id: source, title, documents } = firstWord;
	for await (const event of model.read({ source, title, documents })) void event;
	const current = { model, revision: crypto.randomUUID() };
	await keep('baby', { snapshot: model.snapshot(), revision: current.revision });
	return current;
}

/** The saved Baby if there is one that fits, otherwise a newborn. */
async function start(): Promise<Current> {
	try {
		const kept = await load('baby');
		if (kept) {
			undoable = (await load('checkpoint')) !== undefined;
			return { model: createModel(kept.snapshot), revision: kept.revision };
		}
	} catch (error) {
		console.warn('Starting a new Baby: the saved one couldn’t be restored.', error);
	}
	undoable = false;
	return newborn();
}

/** Whether a checkpoint from before the latest reading is kept. */
let undoable = false;

/** The current Baby; a reset, load or undo swaps in another. */
let current = start().then((started) => {
	publish(started);
	return started;
});

/** Reading, resetting, loading and undoing change the model, so they take turns. */
let changing = false;

function publish({ model, revision }: Current) {
	post({ type: 'state', state: { ...model.state, revision, undoable } });
}

/** Makes `next` the current Baby, kept as it is, with nothing to undo. */
async function replace(next: Current): Promise<void> {
	await keep('baby', { snapshot: next.model.snapshot(), revision: next.revision });
	await clear('checkpoint');
	undoable = false;
	current = Promise.resolve(next);
	publish(next);
}

/**
 * Reads `reading`, first keeping the model as it was so the reading can be undone,
 * then keeps what Baby learned and publishes it, before the request finishes.
 * Cancelled (`signal`), it puts back the model from before it, and the checkpoint
 * that was kept before that, as if it never started.
 */
async function* read(
	now: Current,
	reading: Reading,
	signal: AbortSignal
): AsyncGenerator<BabyEvent> {
	const before = { snapshot: now.model.snapshot(), revision: now.revision };
	const earlier = await load('checkpoint');
	await keep('checkpoint', before);
	undoable = true;
	// From here the model is no longer the one before, even if the reading fails partway.
	now.revision = crypto.randomUUID();
	publish(now);
	try {
		for await (const event of now.model.read(reading, signal)) {
			if (event.type === 'done') {
				await keep('baby', { snapshot: now.model.snapshot(), revision: now.revision });
				publish(now);
			}
			yield event;
		}
	} catch (error) {
		if (!signal.aborted) throw error;
		// The saved Baby is still the one from before: it’s kept only once a reading is done.
		if (earlier) await keep('checkpoint', earlier);
		else await clear('checkpoint');
		undoable = earlier !== undefined;
		const restored = { model: createModel(before.snapshot), revision: before.revision };
		current = Promise.resolve(restored);
		publish(restored);
		yield { type: 'stopped' };
	}
}

/** Forgets the saved Baby, then starts over with a newborn. */
async function* reset(): AsyncGenerator<BabyEvent> {
	await replace(await newborn());
	yield { type: 'done' };
}

/** Brings back the model from before the latest reading. */
async function* undo(): AsyncGenerator<BabyEvent> {
	const kept = await load('checkpoint');
	if (!kept) throw new Error('There’s no reading to undo');
	await replace({ model: createModel(kept.snapshot), revision: kept.revision });
	yield { type: 'done' };
}

/** Replaces the model with the one in `bytes`; a file that isn’t one fails before anything changes. */
async function* loadFile(bytes: Uint8Array): AsyncGenerator<BabyEvent> {
	const model = createModel(decodeSave(bytes));
	await replace({ model, revision: crypto.randomUUID() });
	yield { type: 'done' };
}

async function* save(now: Current): AsyncGenerator<BabyEvent> {
	yield { type: 'file', bytes: encodeSave(now.model.snapshot()) };
	yield { type: 'done' };
}

/** Runs `events`, a change to the model, unless another change is under way. */
async function* change(events: () => AsyncGenerator<BabyEvent>): AsyncGenerator<BabyEvent> {
	if (changing) throw new Error('Baby is already changing');
	changing = true;
	try {
		yield* events();
	} finally {
		changing = false;
	}
}

/** Stoppers for reads asked for and not yet finished, by request id, so a cancel can stop one. */
const stoppers = new Map<string, AbortController>();

function stopper(id: string): AbortController {
	const found = stoppers.get(id);
	if (found) return found;
	const created = new AbortController();
	stoppers.set(id, created);
	return created;
}

function events(
	now: Current,
	request: Exclude<BabyRequest, { type: 'cancel' }>
): AsyncIterable<BabyEvent> {
	switch (request.type) {
		case 'reply':
			return now.model.reply(request.prompt, request.history);
		case 'save':
			return save(now);
		case 'read':
			return change(() => read(now, request.reading, stopper(request.id).signal));
		case 'reset':
			return change(reset);
		case 'undo':
			return change(undo);
		case 'load':
			return change(() => loadFile(request.bytes));
	}
}

self.addEventListener('message', async ({ data: request }: MessageEvent<BabyRequest>) => {
	if (request.type === 'cancel') {
		stoppers.get(request.id)?.abort();
		return;
	}
	// Ready before anything is awaited, so a cancel sent right after the read finds it.
	if (request.type === 'read') stopper(request.id);
	try {
		for await (const event of events(await current, request)) {
			post({ ...event, id: request.id });
		}
	} catch (error) {
		post({ type: 'error', id: request.id, message: String(error) });
	} finally {
		stoppers.delete(request.id);
	}
});
