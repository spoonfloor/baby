import { SvelteSet } from 'svelte/reactivity';
import type { Baby, BabyEvent, BabyState } from '#lib/baby/index.ts';
import type { Pack } from '#lib/library/index.ts';
import type { Notice } from './notices.ts';

export type UserMessage = { id: string; role: 'user'; text: string };
export type BabyMessage = {
	id: string;
	role: 'baby';
	/** Reply text; empty for reading, or when Baby says nothing. */
	text: string;
	/** Baby's latest status, kept after it finishes as a record of what happened. */
	status: string;
	pending: boolean;
};
export type AppMessage = { id: string; role: 'app'; notice: Notice };
export type Message = UserMessage | BabyMessage | AppMessage;

/** The conversation: what's been said and read, and whether Baby is busy. */
export class Chat {
	messages: Message[] = $state([]);
	busy = $derived(this.messages.some((message) => message.role === 'baby' && message.pending));
	/** What Baby knows, as last reported by Baby. */
	knowledge: BabyState | undefined = $state();
	/** Ids of the packs Baby has finished reading. */
	readPacks = new SvelteSet<string>();

	#baby: Baby;

	constructor(baby: Baby) {
		this.#baby = baby;
		baby.subscribe((state) => (this.knowledge = state));
	}

	async send(text: string) {
		this.#assertIdle();
		this.messages.push({ id: crypto.randomUUID(), role: 'user', text });

		const reply = await this.#follow(this.#baby.reply(text));

		if (reply.text === '' && this.knowledge?.words.length === 0) {
			this.messages.push({ id: crypto.randomUUID(), role: 'app', notice: 'newborn' });
		}
	}

	async read(pack: Pack) {
		this.#assertIdle();
		await this.#follow(this.#baby.read(pack.title, pack.documents));
		this.readPacks.add(pack.id);
	}

	#assertIdle() {
		if (this.busy) throw new Error('Baby is busy');
	}

	/** Adds a Baby message and keeps it in step with `events` until done. */
	async #follow(events: AsyncIterable<BabyEvent>): Promise<BabyMessage> {
		const message: BabyMessage = $state({
			id: crypto.randomUUID(),
			role: 'baby',
			text: '',
			status: '',
			pending: true
		});
		this.messages.push(message);

		for await (const event of events) {
			switch (event.type) {
				case 'status':
					message.status = event.text;
					break;
				case 'token':
					message.text += event.text;
					break;
				case 'done':
					message.pending = false;
					break;
			}
		}
		return message;
	}
}
