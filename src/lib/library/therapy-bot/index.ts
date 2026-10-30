import { scriptPrimer } from '#lib/library/primer.ts';
import { exchanges } from './script.ts';

/** Therapy Bot: about 600 one-exchange conversations with a therapist who asks back in your words. */
export const therapyBot = scriptPrimer(
	// The id stays `eliza`: it’s how a saved Baby remembers having read this.
	'eliza',
	'Therapy Bot',
	exchanges.map(([you, baby]) => `you: ${you}\nbaby: ${baby}`).join('\n\n'),
	'Inspired by ELIZA (1966)'
);
