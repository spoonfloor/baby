import type {
	Baby,
	BabyEvent,
	BabyState,
	Reading,
	ReplyStep,
	ReplyTrace,
	Turn
} from '#lib/baby/index.ts';
import { turnTokens } from '#lib/baby/script.ts';
import { isSpecial } from '#lib/baby/vocabulary.ts';
import { graphWords } from '#lib/ui/guessMap.ts';
import { firstWord } from '#lib/library/chatbot-101.ts';
import type { Primer } from '#lib/library/index.ts';
import { nudge, type Notice } from './notices.ts';
import { TAUGHT_SOURCE } from './taught.ts';

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
	/**
	 * A finished reply word by word, for the Graph: the odds at each word (only the
	 * words it shows, see `kept`) and the word picked.
	 */
	steps?: ReplyStep[];
};
export type AppMessage = { id: string; role: 'app'; notice: Notice };
export type Message = UserMessage | BabyMessage | AppMessage;

/** The most of Baby’s other replies offered to pick from when teaching a reply. */
const PICKS = 3;
/** Replies Baby is asked for to find them, so a Baby that keeps saying the same thing stops soon. */
const PICK_ATTEMPTS = 8;

/** The conversation: what's been said and read, and what Baby is busy with. */
export class Chat {
	messages: Message[] = $state([]);
	/** Baby answers one message at a time. */
	replying = $state(false);
	/** Baby reads (and practices) one source at a time, and can still chat meanwhile. */
	reading = $state(false);
	/** The model is being saved, loaded, or undone. */
	changing = $state(false);
	/** Baby is doing something, so the model can’t be reset, saved, loaded, or undone. */
	busy: boolean = $derived(this.replying || this.reading || this.changing);
	/** What Baby knows, as last reported by Baby. */
	knowledge: BabyState | undefined = $state();
	/** Ids of the sources Baby has finished reading, as Baby reports them. */
	readSources: string[] = $derived(this.knowledge?.sources.map(({ id }) => id) ?? []);
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
	 * While teaching, Baby’s own other replies to that message, to teach with a tap
	 * instead of writing one, as Baby said them (like a reply’s `text`). They arrive
	 * one at a time; Baby may have none.
	 */
	picks: string[] = $state([]);

	#baby: Baby;
	/** Bumped whenever teaching starts or ends, so picks found for an earlier one are dropped. */
	#teachingRun = 0;

	constructor(baby: Baby) {
		this.#baby = baby;
		baby.subscribe((state) => (this.knowledge = state));
	}

	async send(text: string) {
		if (this.replying) throw new Error('Baby is already replying');
		if (this.changing) throw new Error('Baby is changing');
		this.replying = true;
		const history = this.#history();
		this.messages.push({ id: crypto.randomUUID(), role: 'user', text });

		const reply = await this.#follow('reply', this.#baby.reply(text, history));
		this.replying = false;

		if (!reply) return;
		const notice = this.#noticeAfterReply(reply);
		if (notice) this.messages.push({ id: crypto.randomUUID(), role: 'app', notice });
	}

	/**
	 * Baby reads `source`: a primer, or a page from the web. `keep` has Baby keep its
	 * text and title, for text that exists nowhere else (see `Reading.keep`).
	 */
	async read(
		{ id: source, title, documents }: Pick<Primer, 'id' | 'title' | 'documents'>,
		{ keep = false } = {}
	) {
		await this.#read({ source, title, documents, ...(keep && { keep }) });
	}

	/**
	 * Starts teaching a reply to the latest message Baby answered, and asks Baby for
	 * other replies to it to offer as picks.
	 */
	startTeaching() {
		if (!this.teachable) throw new Error('Nothing to teach a reply to');
		const prompt = this.teachable.prompt;
		this.#endTeaching();
		this.teaching = prompt;
		// The conversation ends with the message being taught and Baby’s reply to it.
		const history = this.#history();
		const given = history.at(-1)?.text.trim() ?? '';
		void this.#findPicks(this.#teachingRun, prompt, history.slice(0, -2), given);
	}

	cancelTeaching() {
		this.#endTeaching();
	}

	/**
	 * Baby reads `reply` as its answer to the message being taught: the pair as one
	 * turn each, like a lesson, so it learns what to say back, not just the words.
	 */
	async teach(reply: string) {
		const prompt = this.teaching;
		if (prompt === undefined) throw new Error('Not teaching a reply');
		if (this.reading) throw new Error('Baby is already reading');
		this.#endTeaching();
		this.messages.push({ id: crypto.randomUUID(), role: 'user', text: reply, replyTo: prompt });
		await this.#read({
			source: `${TAUGHT_SOURCE}${crypto.randomUUID()}`,
			title: `Your reply to ‘${prompt}’`,
			documents: [[...turnTokens('you', prompt), ...turnTokens('baby', reply)]],
			keep: true
		});
	}

	/**
	 * Forgets everything Baby has ever read and clears the conversation. Refused while
	 * Baby is busy, so no reading can save over the reset.
	 */
	async reset() {
		await this.#change(async () => {
			try {
				for await (const event of this.#baby.reset()) if (event.type === 'done') break;
				this.messages = [];
				this.#endTeaching();
			} catch (error) {
				console.error(error);
				this.messages.push({ id: crypto.randomUUID(), role: 'app', notice: 'failed' });
			}
		});
	}

	/** Says `notice` in the app’s voice, about something done outside the conversation. */
	notify(notice: Notice) {
		this.messages.push({ id: crypto.randomUUID(), role: 'app', notice });
	}

	/**
	 * Brings back the model from before the latest reading, keeping the conversation,
	 * and says so. Refused while Baby is busy.
	 */
	async undo() {
		await this.#change(async () => {
			try {
				for await (const event of this.#baby.undo()) if (event.type === 'done') break;
				this.messages.push({ id: crypto.randomUUID(), role: 'app', notice: 'undone' });
			} catch (error) {
				console.error(error);
				this.messages.push({ id: crypto.randomUUID(), role: 'app', notice: 'failed' });
			}
		});
	}

	/** The whole model as a `.baby` file. Throws if Baby is busy or saving fails. */
	async save(): Promise<Uint8Array<ArrayBuffer>> {
		return this.#change(async () => {
			for await (const event of this.#baby.save()) if (event.type === 'file') return event.bytes;
			throw new Error('Baby sent no file');
		});
	}

	/**
	 * Replaces the model with the one in `bytes` and clears the conversation, which
	 * came from another model. Throws, changing nothing, if Baby is busy or the file
	 * can’t be loaded.
	 */
	async load(bytes: Uint8Array<ArrayBuffer>) {
		await this.#change(async () => {
			for await (const event of this.#baby.load(bytes)) if (event.type === 'done') break;
			this.messages = [];
			this.#endTeaching();
		});
	}

	/** Runs `work`, a change to the whole model, unless Baby is busy. */
	async #change<T>(work: () => Promise<T>): Promise<T> {
		if (this.busy) throw new Error('Baby is busy');
		this.changing = true;
		try {
			return await work();
		} finally {
			this.changing = false;
		}
	}

	#endTeaching() {
		this.teaching = undefined;
		this.picks = [];
		this.#teachingRun++;
	}

	/**
	 * Asks Baby to reply to `prompt` again, after the same `history`, and offers each
	 * new reply that ended cleanly as a pick: not empty, not `given` (the reply being
	 * replaced), and not one already offered. Stops once teaching `run` is over.
	 * Picks are a convenience, so a failure only stops the search.
	 */
	async #findPicks(run: number, prompt: string, history: Turn[], given: string) {
		try {
			for (let attempt = 0; attempt < PICK_ATTEMPTS; attempt++) {
				let text = '';
				let stop: ReplyTrace['stop'] | undefined;
				for await (const event of this.#baby.reply(prompt, history)) {
					if (event.type === 'token') text += event.text;
					if (event.type === 'trace') stop = event.trace.stop;
				}
				if (run !== this.#teachingRun) return;
				text = text.trim();
				if (stop === 'eos' && text && text !== given && !this.picks.includes(text)) {
					this.picks.push(text);
					if (this.picks.length === PICKS) return;
				}
			}
		} catch (error) {
			console.error(error);
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
		if (this.changing) throw new Error('Baby is changing');
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
		// Kept off the message until the reply is finished: no one looks at them sooner.
		let steps: ReplyStep[] = [];

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
						steps = step(steps, event);
						break;
					case 'guesses':
						steps = step(steps, event);
						break;
					case 'trace':
						message.trace = event.trace;
						break;
					case 'done':
						if (steps.length > 0) message.steps = kept(steps);
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

/** `steps` after `event`: odds start the next step, a word is what was picked at the latest. */
function step(steps: ReplyStep[], event: BabyEvent): ReplyStep[] {
	if (event.type === 'guesses') return [...steps, { guesses: event.guesses }];
	const latest = steps.at(-1);
	if (event.type === 'token' && latest) {
		return [...steps.slice(0, -1), { ...latest, picked: event.text.trim() }];
	}
	return steps;
}

/**
 * A reply with only the odds the Graph can show: at every step, the chances of the
 * words in its Graph (see `graphWords`) and of every marker, which the Graph adds
 * up into one.
 */
function kept(steps: readonly ReplyStep[]): ReplyStep[] {
	const words = graphWords(steps);
	return steps.map(({ guesses, picked }) => ({
		guesses: guesses.filter(({ word }) => words.has(word) || isSpecial(word)),
		...(picked === undefined ? {} : { picked })
	}));
}

/** Whether more than half the words of a message were ones Baby had never read. */
function mostlyUnknown({ prompt, unknown }: ReplyTrace): boolean {
	const unknownWords = prompt.filter((word) => unknown.includes(word)).length;
	return unknownWords > prompt.length / 2;
}
