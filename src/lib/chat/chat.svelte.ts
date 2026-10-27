import type { Baby } from '#lib/baby/index.ts';

export type UserMessage = { id: string; role: 'user'; text: string };
export type BabyMessage = {
	id: string;
	role: 'baby';
	text: string;
	/** Baby's latest status, kept after the reply finishes as a record of what happened. */
	status: string;
	pending: boolean;
};
export type Message = UserMessage | BabyMessage;

/** The conversation: what's been said, and whether Baby is mid-reply. */
export class Chat {
	messages: Message[] = $state([]);
	busy = $derived(this.messages.some((message) => message.role === 'baby' && message.pending));

	#baby: Baby;

	constructor(baby: Baby) {
		this.#baby = baby;
	}

	async send(text: string) {
		if (this.busy) throw new Error('Baby is still replying');

		this.messages.push({ id: crypto.randomUUID(), role: 'user', text });

		const reply: BabyMessage = $state({
			id: crypto.randomUUID(),
			role: 'baby',
			text: '',
			status: '',
			pending: true
		});
		this.messages.push(reply);

		for await (const event of this.#baby.reply(text)) {
			switch (event.type) {
				case 'status':
					reply.status = event.text;
					break;
				case 'token':
					reply.text += event.text;
					break;
				case 'done':
					reply.pending = false;
					break;
			}
		}
	}
}
