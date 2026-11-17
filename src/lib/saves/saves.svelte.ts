import type { BabyState } from '#lib/baby/index.ts';
import { deviceStore } from './deviceStore.ts';
import { normalizeAddress, serverStore, type Connection } from './serverStore.ts';
import { problemText, timestamp } from './describe.ts';
import { StoreError, type Expected, type SaveStore, type StoredSave } from './store.ts';

/** Where a save is kept. */
export type Place = 'device' | 'server';

/** The part of the chat that saves and loads the model (see `Chat`). */
export interface Model {
	readonly knowledge: BabyState | undefined;
	/** Knows only its first word, so there’s nothing to lose by replacing it. */
	readonly untrained: boolean;
	save(): Promise<Uint8Array<ArrayBuffer>>;
	load(bytes: Uint8Array<ArrayBuffer>): Promise<void>;
}

/** Small values kept on this device between visits (localStorage in the app). */
export interface Settings {
	get(key: string): string | undefined;
	set(key: string, value: string): void;
	remove(key: string): void;
}

/** The save the current model was last saved as or loaded from, and its version then. */
interface Origin {
	/** The model’s revision then; the model is unsaved once its revision differs. */
	revision: string;
	place: Place;
	id: string;
	version: number;
}

const CONNECTION_KEY = 'baby.server';
const ORIGIN_KEY = 'baby.origin';

/**
 * The saved models on this device and on a connected server, and the actions on
 * them. Remembers which save the current model came from, so it can tell whether
 * the model has changed since, and whether a save changed elsewhere meanwhile.
 */
export class Saves {
	device: StoredSave[] = $state([]);
	server: StoredSave[] = $state([]);
	/** The connected server, if any. */
	connection: Connection | undefined = $state();
	/** Why the server’s saves couldn’t be listed, if they couldn’t. */
	serverProblem: string | undefined = $state();
	#origin: Origin | undefined = $state();

	/**
	 * Whether the current model is held by a save: `untrained` has nothing to lose,
	 * `unsaved` has training that no save holds, which replacing it would lose.
	 */
	standing: 'untrained' | 'unsaved' | 'saved' = $derived.by(() => {
		const revision = this.#model.knowledge?.revision;
		if (revision === undefined || this.#model.untrained) return 'untrained';
		return revision === this.#origin?.revision ? 'saved' : 'unsaved';
	});
	unsaved: boolean = $derived(this.standing === 'unsaved');

	#model: Model;
	#settings: Settings;
	#deviceStore: SaveStore;
	#serverStore: (connection: Connection) => SaveStore;

	constructor(
		model: Model,
		{
			settings = browserSettings,
			device = deviceStore,
			server = serverStore
		}: {
			settings?: Settings;
			device?: SaveStore;
			server?: (connection: Connection) => SaveStore;
		} = {}
	) {
		this.#model = model;
		this.#settings = settings;
		this.#deviceStore = device;
		this.#serverStore = server;
		this.connection = parse<Connection>(settings.get(CONNECTION_KEY));
		this.#origin = parse<Origin>(settings.get(ORIGIN_KEY));
	}

	/** Lists the saves again, from this device and the server. */
	async refresh() {
		await Promise.all([this.#refresh('device'), this.#refresh('server')]);
	}

	/** The save named `name` in `place`, which saving under that name would replace. */
	named(place: Place, name: string): StoredSave | undefined {
		return this.#list(place).find((save) => save.name === name.trim());
	}

	/** `name`, or the first of “name (2)”, “name (3)”… that no save in `place` has. */
	unusedName(place: Place, name: string): string {
		let candidate = name.trim();
		for (let n = 2; this.named(place, candidate); n++) candidate = `${name.trim()} (${n})`;
		return candidate;
	}

	/**
	 * Saves the current model as `name` in `place`, replacing the save of that name
	 * if there is one. Throws a `conflict` StoreError if that save changed since this
	 * device last saw it, unless `force`.
	 */
	async save(name: string, place: Place, { force = false } = {}) {
		const knowledge = this.#model.knowledge;
		if (!knowledge) throw new Error('Baby hasn’t started yet');
		const existing = this.named(place, name);
		const id = existing?.id ?? crypto.randomUUID();
		const expected: Expected = force
			? 'any'
			: existing
				? { version: this.#knownVersion(place, existing) }
				: 'new';
		const bytes = await this.#model.save();
		const stored = await this.#store(place).write(
			{
				id,
				name: name.trim(),
				savedAt: timestamp(),
				words: knowledge.words.length,
				sources: knowledge.sources.length
			},
			bytes,
			expected
		);
		this.#remember({ revision: knowledge.revision, place, id, version: stored.version });
		await this.#refresh(place);
	}

	/** Replaces the current model with the save `id` in `place`, clearing the conversation. */
	async load(place: Place, id: string) {
		const { bytes, version } = await this.#store(place).read(id);
		await this.#model.load(bytes);
		const revision = this.#model.knowledge?.revision;
		if (revision !== undefined) this.#remember({ revision, place, id, version });
	}

	async rename(place: Place, id: string, name: string) {
		const save = this.#find(place, id);
		if (this.named(place, name)) throw new StoreError('taken', 'That name is taken');
		const stored = await this.#store(place).rename(id, name.trim(), { version: save.version });
		const origin = this.#originAt(place, id);
		if (origin) this.#remember({ ...origin, version: stored.version });
		await this.#refresh(place);
	}

	/** Moves the save `id` from `place` to the other place, keeping its name. */
	async move(place: Place, id: string) {
		const save = this.#find(place, id);
		const to: Place = place === 'device' ? 'server' : 'device';
		if (this.named(to, save.name)) throw new StoreError('taken', 'That name is taken');
		const { bytes } = await this.#store(place).read(id);
		const stored = await this.#store(to).write(save, bytes, 'new');
		await this.#store(place).remove(id);
		const origin = this.#originAt(place, id);
		if (origin) this.#remember({ ...origin, place: to, version: stored.version });
		await Promise.all([this.#refresh(place), this.#refresh(to)]);
	}

	async remove(place: Place, id: string) {
		await this.#store(place).remove(id);
		await this.#refresh(place);
	}

	/** Connects to the server at `address` if `token` works there, and lists its saves. */
	async connect(address: string, token: string) {
		const normalized = normalizeAddress(address);
		if (!normalized) throw new StoreError('address', 'Not a server address');
		const connection = { address: normalized, token: token.trim() };
		this.server = await this.#serverStore(connection).list();
		this.serverProblem = undefined;
		this.connection = connection;
		this.#settings.set(CONNECTION_KEY, JSON.stringify(connection));
	}

	disconnect() {
		this.connection = undefined;
		this.server = [];
		this.serverProblem = undefined;
		this.#settings.remove(CONNECTION_KEY);
	}

	#list(place: Place): StoredSave[] {
		return place === 'device' ? this.device : this.server;
	}

	#find(place: Place, id: string): StoredSave {
		const save = this.#list(place).find((save) => save.id === id);
		if (!save) throw new StoreError('missing', 'That save is gone');
		return save;
	}

	#store(place: Place): SaveStore {
		if (place === 'device') return this.#deviceStore;
		if (!this.connection) throw new StoreError('unreachable', 'No server is connected');
		return this.#serverStore(this.connection);
	}

	async #refresh(place: Place) {
		if (place === 'device') {
			this.device = await this.#deviceStore.list();
			return;
		}
		if (!this.connection) return;
		try {
			this.server = await this.#serverStore(this.connection).list();
			this.serverProblem = undefined;
		} catch (error) {
			this.serverProblem = problemText(error);
		}
	}

	/**
	 * The version of `save` this device last saw: when it’s the save the model came
	 * from, the version then, so a change made elsewhere since is caught.
	 */
	#knownVersion(place: Place, save: StoredSave): number {
		return this.#originAt(place, save.id)?.version ?? save.version;
	}

	/** Where the model came from, if that’s the save `id` in `place`. */
	#originAt(place: Place, id: string): Origin | undefined {
		const origin = this.#origin;
		return origin?.place === place && origin.id === id ? origin : undefined;
	}

	#remember(origin: Origin) {
		this.#origin = origin;
		this.#settings.set(ORIGIN_KEY, JSON.stringify(origin));
	}
}

function parse<T>(value: string | undefined): T | undefined {
	if (value === undefined) return undefined;
	try {
		return JSON.parse(value) as T;
	} catch {
		return undefined;
	}
}

/** localStorage, where it’s available; where it isn’t (private browsing), nothing is remembered. */
const browserSettings: Settings = {
	get(key) {
		try {
			return localStorage.getItem(key) ?? undefined;
		} catch {
			return undefined;
		}
	},
	set(key, value) {
		try {
			localStorage.setItem(key, value);
		} catch {
			// Not remembered: the next visit asks again.
		}
	},
	remove(key) {
		try {
			localStorage.removeItem(key);
		} catch {
			// Nothing to forget.
		}
	}
};
