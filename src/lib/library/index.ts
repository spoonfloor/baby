import { chatbot101 } from './chatbot-101.ts';
import type { Shelf } from './pack.ts';

export type { Pack, Shelf } from './pack.ts';

/** Everything in the + menu’s reading shelves, in menu order. */
export const shelves: Shelf[] = [
	{ title: 'Chatbot 101', ordered: true, packs: chatbot101 },
	// Stories and other reading that teach words and grammar. Not written yet.
	{ title: 'Subjects', ordered: false, packs: [] }
];
