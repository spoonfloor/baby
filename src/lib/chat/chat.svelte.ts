import type {
	Baby,
	BabyEvent,
	BabyState,
	Guess,
	Reading,
	ReplyTrace,
	Turn
} from '#lib/baby/index.ts';
import { turnTokens } from '#lib/baby/script.ts';
import { firstWord } from '#lib/library/chatbot-101.ts';
import type { Primer } from '#lib/library/index.ts';
import { nudge, type Notice } from './notices.ts';

export type UserMessage = {
	id: string;
	role: 'user';
	text: string;
	/** The message this one teaches Baby a reply to, when it’s a taught reply. */
	replyTo?: string;
};
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
	/** Baby knows only the first word it was born knowing, and isn’t reading anything else yet. */
	untrained: boolean = $derived(
		!this.reading && this.readSources.every((source) => source === firstWord.id)
	);
	/**
	 * The message Baby’s latest reply answered, while the user can teach a better
	 * reply: the reply is finished, nothing has been said since, and Baby isn’t
	 * reading (it reads one thing at a time). `after` is the message that ends the
	 * turn, where the offer goes: the reply, or the last notice the app added after it.
	 */
	teachable: { prompt: string; after: string } | undefined = $derived.by(() => {
		if (this.reading) return undefined;
		const index = this.messages.findLastIndex(
			(message) => message.role === 'user' || message.role === 'baby'
		);
		const reply = this.messages[index];
		const prompt = this.messages[index - 1];
		if (reply?.role !== 'baby' || reply.request !== 'reply' || reply.pending) return undefined;
		if (prompt?.role !== 'user') return undefined;
		return { prompt: prompt.text, after: this.messages.at(-1)?.id ?? reply.id };
	});
	/** The message the user is teaching Baby a reply to; their next message is that reply. */
	teaching: string | undefined = $state();
	/**
	 * Where Baby’s latest reply has got to: what it has said so far, and the odds of
	 * each word it could say next. When the reply is done, the odds its last pick was
	 * drawn from. Raw: replaced whole at every word.
	 */
	nextWord: { said: string; guesses: Guess[] } | undefined = $state.raw();

	#baby: Baby;

	constructor(baby: Baby) {
		this.#baby = baby;
		baby.subscribe((state) => (this.knowledge = state));
	}

	async send(text: string) {
		if (this.replying) throw new Error('Baby is already replying');
		this.replying = true;
		this.nextWord = undefined;
		const history = this.#history();
		this.messages.push({ id: crypto.randomUUID(), role: 'user', text });

		const reply = await this.#follow('reply', this.#baby.reply(text, history));
		this.replying = false;

		if (!reply) return;
		const notice = this.#noticeAfterReply(reply);
		if (notice) this.messages.push({ id: crypto.randomUUID(), role: 'app', notice });
	}

	/**
	 * Baby’s guesses at the first word it would say if `prompt` were sent now, after
	 * the conversation so far. Reads the conversation before its first await, so an
	 * effect calling this reruns when the conversation changes.
	 */
	async guess(prompt: string): Promise<Guess[]> {
		for await (const event of this.#baby.guess(prompt, this.#history())) {
			if (event.type === 'guesses') return event.guesses;
		}
		throw new Error('Baby finished without guessing');
	}

	async read(primer: Primer) {
		const { id: source, title, documents } = primer;
		await this.#read({ source, title, documents });
	}

	/** Starts teaching a reply to the latest message Baby answered. */
	startTeaching() {
		if (!this.teachable) throw new Error('Nothing to teach a reply to');
		this.teaching = this.teachable.prompt;
	}

	cancelTeaching() {
		this.teaching = undefined;
	}

	/**
	 * Baby reads `reply` as its answer to the message being taught: the pair as one
	 * turn each, like a lesson, so it learns what to say back, not just the words.
	 */
	async teach(reply: string) {
		const prompt = this.teaching;
		if (prompt === undefined) throw new Error('Not teaching a reply');
		if (this.reading) throw new Error('Baby is already reading');
		this.teaching = undefined;
		this.messages.push({ id: crypto.randomUUID(), role: 'user', text: reply, replyTo: prompt });
		await this.#read({
			source: `taught:${crypto.randomUUID()}`,
			title: `Your reply to ‘${prompt}’`,
			documents: [[...turnTokens('you', prompt), ...turnTokens('baby', reply)]]
		});
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
			this.teaching = undefined;
			this.nextWord = undefined;
		} catch (error) {
			console.error(error);
			this.messages.push({ id: crypto.randomUUID(), role: 'app', notice: 'failed' });
		}
	}

	/**
	 * The conversation so far as Baby’s turns and yours: what you said and what Baby
	 * replied, nothing the app said, and not a taught reply, which Baby reads instead.
	 */
	#history(): Turn[] {
		return this.messages.flatMap((message): Turn[] => {
			if (message.role === 'user' && message.replyTo === undefined) {
				return [{ speaker: 'you', text: message.text }];
			}
			if (message.role === 'baby' && message.request === 'reply' && !message.pending) {
				return [{ speaker: 'baby', text: message.text }];
			}
			return [];
		});
	}

	/**
	 * While Baby knows only its first word, the app nudges toward training on a
	 * schedule. Once it has read more, the app points out a message Baby couldn’t
	 * follow, the first time only: its status line says so every time after.
	 */
	#noticeAfterReply(reply: BabyMessage): Notice | undefined {
		if (this.untrained) {
			const turns = this.messages.filter(
				(message) => message.role === 'user' && message.replyTo === undefined
			).length;
			return nudge(turns);
		}
		const pointedOut = this.messages.some(
			(message) => message.role === 'app' && message.notice === 'unrecognized'
		);
		if (!pointedOut && reply.trace && mostlyUnknown(reply.trace)) return 'unrecognized';
		return undefined;
	}

	async #read(reading: Reading) {
		if (this.reading) throw new Error('Baby is already reading');
		this.reading = true;
		await this.#follow('read', this.#baby.read(reading));
		this.reading = false;
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
					case 'guesses':
						this.nextWord = { said: message.text, guesses: event.guesses };
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
