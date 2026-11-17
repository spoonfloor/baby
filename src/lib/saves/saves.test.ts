import { describe, expect, it } from 'vitest';
import type { BabyState } from '#lib/baby/index.ts';
import { describeSave } from './describe.ts';
import { Saves, type Model, type Settings } from './saves.svelte.ts';
import { meets, newestFirst, StoreError, type SaveStore, type StoredSave } from './store.ts';

/** A store in memory, versioned like the real ones. */
function memoryStore(): SaveStore {
	const saves = new Map<string, { save: StoredSave; bytes: Uint8Array<ArrayBuffer> }>();
	const conflict = () => new StoreError('conflict', 'Changed');
	return {
		list: async () => newestFirst([...saves.values()].map(({ save }) => save)),
		async read(id) {
			const found = saves.get(id);
			if (!found) throw new StoreError('missing', 'Gone');
			return { bytes: found.bytes, version: found.save.version };
		},
		async write(info, bytes, expected) {
			const found = saves.get(info.id)?.save;
			if (!meets(expected, found?.version)) throw conflict();
			const save = { ...info, version: (found?.version ?? 0) + 1 };
			saves.set(info.id, { save, bytes });
			return save;
		},
		async rename(id, name, expected) {
			const found = saves.get(id);
			if (!found) throw new StoreError('missing', 'Gone');
			if (!meets(expected, found.save.version)) throw conflict();
			found.save = { ...found.save, name, version: found.save.version + 1 };
			return found.save;
		},
		async remove(id) {
			saves.delete(id);
		}
	};
}

function memorySettings(): Settings {
	const values = new Map<string, string>();
	return {
		get: (key) => values.get(key),
		set: (key, value) => void values.set(key, value),
		remove: (key) => void values.delete(key)
	};
}

/** A model whose file is its sources, and whose revision changes with every reading. */
interface FakeModel extends Model {
	knowledge: BabyState | undefined;
	untrained: boolean;
	read(source: string): void;
}

function fakeModel(): FakeModel {
	let revision = 0;
	const model = {
		knowledge: undefined as BabyState | undefined,
		untrained: false,
		read(source: string) {
			const sources = [...(model.knowledge?.sources ?? []), { id: source }];
			model.knowledge = { words: ['a'], sources, revision: `r${++revision}`, undoable: true };
		},
		async save() {
			return new TextEncoder().encode(
				(model.knowledge?.sources ?? []).map(({ id }) => id).join(',')
			);
		},
		async load(bytes: Uint8Array) {
			const sources = new TextDecoder()
				.decode(bytes)
				.split(',')
				.map((id) => ({ id }));
			model.knowledge = { words: ['a'], sources, revision: `r${++revision}`, undoable: false };
		}
	};
	model.read('hello');
	return model;
}

/** The first of `list`, which the test expects there to be. */
function first<T>(list: T[]): T {
	const [item] = list;
	if (item === undefined) throw new Error('Expected a save');
	return item;
}

function setUp() {
	const model = fakeModel();
	const device = memoryStore();
	const server = memoryStore();
	const settings = memorySettings();
	const saves = new Saves(model, { settings, device, server: () => server });
	return { model, device, server, settings, saves };
}

describe('Saves', () => {
	it('knows when the model has training no save holds', async () => {
		const { model, saves } = setUp();
		expect(saves.unsaved).toBe(true);

		await saves.save('First', 'device');
		expect(saves.unsaved).toBe(false);
		expect(saves.device).toMatchObject([{ name: 'First', sources: 1, version: 1 }]);

		model.read('monkeys');
		expect(saves.unsaved).toBe(true);
	});

	it('never counts an untrained model as unsaved', () => {
		const { model, saves } = setUp();
		model.untrained = true;
		expect(saves.unsaved).toBe(false);
		expect(saves.standing).toBe('untrained');
	});

	it('replaces a save of the same name, and loads it back', async () => {
		const { model, saves } = setUp();
		await saves.save('Mine', 'device');
		model.read('monkeys');
		await saves.save('Mine', 'device');
		expect(saves.device).toHaveLength(1);
		expect(saves.device[0]).toMatchObject({ sources: 2, version: 2 });

		model.read('aesop');
		await saves.load('device', first(saves.device).id);
		expect(model.knowledge?.sources.map(({ id }) => id)).toEqual(['hello', 'monkeys']);
		expect(saves.unsaved).toBe(false);
	});

	it('catches a save changed on another device since it was loaded', async () => {
		const { model, saves, server } = setUp();
		await saves.connect('https://baby.example.com', 'token');
		await saves.save('Shared', 'server');
		const id = first(saves.server).id;
		await saves.load('server', id);

		// Another device saves over it, and this one lists the saves again.
		await server.write({ ...first(saves.server), words: 9 }, new Uint8Array(), { version: 1 });
		await saves.refresh();
		model.read('monkeys');

		await expect(saves.save('Shared', 'server')).rejects.toMatchObject({ kind: 'conflict' });
		await saves.save('Shared', 'server', { force: true });
		expect(saves.server).toMatchObject([{ id, version: 3, sources: 2 }]);
		expect(saves.unusedName('server', 'Shared')).toBe('Shared (2)');
	});

	it('moves saves between places, unless the name is taken there', async () => {
		const { model, saves } = setUp();
		await saves.connect('baby.example.com', 'token');
		expect(saves.connection?.address).toBe('https://baby.example.com');

		await saves.save('Mine', 'device');
		await saves.move('device', first(saves.device).id);
		expect(saves.device).toEqual([]);
		expect(saves.server).toMatchObject([{ name: 'Mine' }]);
		expect(saves.unsaved).toBe(false);

		model.read('monkeys');
		await saves.save('Mine', 'device');
		await expect(saves.move('device', first(saves.device).id)).rejects.toMatchObject({
			kind: 'taken'
		});
		await expect(saves.rename('server', first(saves.server).id, 'Mine')).rejects.toMatchObject({
			kind: 'taken'
		});
	});

	it('deletes several saves across places, carrying on past ones that fail', async () => {
		const model = fakeModel();
		const device = memoryStore();
		const server = memoryStore();
		let serverDown = false;
		const saves = new Saves(model, {
			settings: memorySettings(),
			device,
			server: () =>
				serverDown
					? {
							...server,
							remove: async () => {
								throw new StoreError('unreachable', 'Down');
							}
						}
					: server
		});
		await saves.connect('https://baby.example.com', 'token');
		await saves.save('Here', 'device');
		await saves.save('Also here', 'device');
		await saves.save('There', 'server');
		const keys = [
			...saves.device.map(({ id }) => ({ place: 'device' as const, id })),
			...saves.server.map(({ id }) => ({ place: 'server' as const, id }))
		];

		serverDown = true;
		const { failed, error } = await saves.remove(keys);

		expect(saves.device).toEqual([]);
		expect(failed).toEqual(keys.filter(({ place }) => place === 'server'));
		expect(error).toMatchObject({ kind: 'unreachable' });
		expect(saves.server).toMatchObject([{ name: 'There' }]);

		serverDown = false;
		expect(await saves.remove(failed)).toEqual({ failed: [] });
		expect(saves.server).toEqual([]);
	});

	it('remembers the server between visits, and forgets it on disconnect', async () => {
		const { model, settings, server, saves } = setUp();
		await expect(saves.connect('ftp://nope', 'token')).rejects.toMatchObject({ kind: 'address' });
		await saves.connect('https://baby.example.com/', 'token');

		const later = new Saves(model, { settings, device: memoryStore(), server: () => server });
		expect(later.connection).toEqual({ address: 'https://baby.example.com', token: 'token' });

		later.disconnect();
		expect(new Saves(model, { settings }).connection).toBeUndefined();
	});

	it('describes a save at a glance', () => {
		const now = new Date(2026, 10, 17, 15);
		const save = {
			id: 'a',
			name: 'Mine',
			words: 1,
			sources: 3,
			version: 1,
			savedAt: new Date(2026, 10, 12).toISOString()
		};
		expect(describeSave(save, now)).toBe('1 word · 3 sources · Nov 12');
		expect(describeSave({ ...save, savedAt: now.toISOString() }, now)).toBe(
			'1 word · 3 sources · today'
		);
	});
});
