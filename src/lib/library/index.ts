import { chatbot101 } from './chatbot-101.ts';
import { eliza } from './eliza/index.ts';
import type { Group } from './primer.ts';

export type { Group, Primer } from './primer.ts';

/** Every primer, in sources-panel order: Chatbot 101 first, then subjects A–Z. */
export const groups: Group[] = [
	{ title: 'Chatbot 101', primers: chatbot101 },
	// Therapy Bot imitates a therapist.
	{ title: 'Psychology', primers: [eliza] }
];
