import type { Baby, BabyEvent, BabyState, ReplyTrace } from '#lib/baby/index.ts';
import type { Primer } from '#lib/library/index.ts';
import type { Notice } from './notices.ts';

export type UserMessage = { id: string; role: 'user'; text: string };
export type BabyMessage = {
	id: string;
	role: 'baby';
	/** What Baby was asked to do. */
	request: 'reply' | 'read';
	/** Reply text; empty for reading, or when Baby says nothing. */
	text: string;
	/** Baby's latest status, kept after it finishes as a record of what happened. */
	status: string;
	pending: boolean;
	/** How far through its work Baby is, when it knows how much there is (practice). */
	progress?: { done: number; total: number };
	/** How a finished reply came about; only replies have one. */
	trace?: ReplyTrace;
};
export type AppMessage = { id: string; role: 'app'; notice: Notice };
export type Message = UserMessage | BabyMessage | AppMessage;

/** The conversation: what's been said and read, and what Baby is busy with. */
export class Chat {
	messages: Message[] = $state([]);
	/** Baby answers one message at a time. */
	replying = $state(false);
	/** Baby reads (and practices) one source at a time, and can still chat meanwhile. */
	reading = $state(false);
	/** What Baby knows, as last reported by Baby. */
	knowledge: BabyState | undefined = $state();
	/** Ids of the sources Baby has finished reading, as Baby reports them. */
	readSources: string[] = $derived(this.knowledge?.sources ?? []);

	#baby: Baby;

	constructor(baby: Baby) {
		this.#baby = baby;
		baby.subscribe((state) => (this.knowledge = state));
	}

	async send(text: string) {
		if (this.replying) throw new Error('Baby is already replying');
		this.replying = true;
		this.messages.push({ id: crypto.randomUUID(), role: 'user', text });

		const reply = await this.#follow('reply', this.#baby.reply(text));
		this.replying = false;

		if (!reply) return;
		if (reply.text === '' && this.knowledge?.words.length === 0) {
			this.messages.push({ id: crypto.randomUUID(), role: 'app', notice: 'newborn' });
		} else if (reply.trace && mostlyUnknown(reply.trace)) {
			this.messages.push({ id: crypto.randomUUID(), role: 'app', notice: 'unrecognized' });
		}
	}

	async read(primer: Primer) {
		if (this.reading) throw new Error('Baby is already reading');
		this.reading = true;
		const { id: source, title, documents } = primer;
		await this.#follow('read', this.#baby.read({ source, title, documents }));
		this.reading = false;
	}

	/**
	 * Forgets everything Baby has ever read and clears the conversation. Refused while
	 * Baby is busy, so no reading can save over the reset.
	 */
	async reset() {
		if (this.replying || this.reading) throw new Error('Baby is busy');
		try {
			for await (const event of this.#baby.reset()) if (event.type === 'done') break;
			this.messages = [];
		} catch (error) {
			console.error(error);
			this.messages.push({ id: crypto.randomUUID(), role: 'app', notice: 'failed' });
		}
	}

	/**
	 * Adds a Baby message and keeps it in step with `events` until done. If the
	 * request fails, the message ends where it got to, the app says so, and this
	 * returns undefined; it never throws, so Baby is never left busy.
	 */
	async #follow(
		request: BabyMessage['request'],
		events: AsyncIterable<BabyEvent>
	): Promise<BabyMessage | undefined> {
		const message: BabyMessage = $state({
			id: crypto.randomUUID(),
			role: 'baby',
			request,
			text: '',
			status: '',
			pending: true
		});
		this.messages.push(message);

		try {
			for await (const event of events) {
				switch (event.type) {
					case 'status':
						message.status = event.text;
						break;
					case 'progress':
						message.progress = { done: event.done, total: event.total };
						break;
					case 'token':
						message.text += event.text;
						break;
					case 'trace':
						message.trace = event.trace;
						break;
					case 'done':
						message.pending = false;
						break;
				}
			}
			return message;
		} catch (error) {
			console.error(error);
			message.pending = false;
			this.messages.push({ id: crypto.randomUUID(), role: 'app', notice: 'failed' });
			return undefined;
		}
	}
}

/** Whether more than half the words of a message were ones Baby had never read. */
function mostlyUnknown({ prompt, unknown }: ReplyTrace): boolean {
	const unknownWords = prompt.filter((word) => unknown.includes(word)).length;
	return unknownWords > prompt.length / 2;
}
