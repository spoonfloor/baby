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
 */
async function* read(now: Current, reading: Reading): AsyncGenerator<BabyEvent> {
	await keep('checkpoint', { snapshot: now.model.snapshot(), revision: now.revision });
	undoable = true;
	// From here the model is no longer the one before, even if the reading fails partway.
	now.revision = crypto.randomUUID();
	publish(now);
	for await (const event of now.model.read(reading)) {
		if (event.type === 'done') {
			await keep('baby', { snapshot: now.model.snapshot(), revision: now.revision });
			publish(now);
		}
		yield event;
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

function events(now: Current, request: BabyRequest): AsyncIterable<BabyEvent> {
	switch (request.type) {
		case 'reply':
			return now.model.reply(request.prompt, request.history);
		case 'save':
			return save(now);
		case 'read':
			return change(() => read(now, request.reading));
		case 'reset':
			return change(reset);
		case 'undo':
			return change(undo);
		case 'load':
			return change(() => loadFile(request.bytes));
	}
}

self.addEventListener('message', async ({ data: request }: MessageEvent<BabyRequest>) => {
	try {
		for await (const event of events(await current, request)) {
			post({ ...event, id: request.id });
		}
	} catch (error) {
		post({ type: 'error', id: request.id, message: String(error) });
	}
});
