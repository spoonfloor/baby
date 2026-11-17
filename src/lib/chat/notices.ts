/**
 * What the app says, in its own voice, separate from Baby's. Notices
 * are stored by name and turned into copy at render time, so copy that depends on
 * the device (Click vs Tap) stays current.
 */
export type Notice = 'oneWord' | 'guess' | 'repertoire' | 'unrecognized' | 'undone' | 'failed';

export function noticeText(notice: Notice, pointerVerb: 'Click' | 'Tap'): string {
	switch (notice) {
		case 'oneWord':
			return `Baby is brand new and only knows 1 word. ${pointerVerb} Greetings, under Chatbot 101 in the Sources panel above, to start Baby’s training.`;
		case 'guess':
			return 'No, seriously, Baby is an aspiring large language model (LLM) and has only been trained on 1 word (can you guess which one? 😉).';
		case 'repertoire':
			return 'Are you sure you wouldn’t like to expand Baby’s repertoire? Try training Baby on one of the sources in the Sources panel above.';
		case 'unrecognized':
			return 'Baby didn’t know most of those words. Teach Baby a reply to show it how to respond.';
		case 'undone':
			return 'Undid the last training. Baby is back to how it was before.';
		case 'failed':
			return 'Something went wrong in the app, so Baby couldn’t finish. Try again.';
	}
}

/** Nudges toward training, by the turn they follow, while Baby knows only its first word. */
const NUDGES: Partial<Record<number, Notice>> = { 2: 'oneWord', 3: 'guess', 6: 'repertoire' };
/** After the last nudge, it comes back every this many turns. */
const NUDGE_REPEAT = 10;
const LAST_NUDGE = Math.max(...Object.keys(NUDGES).map(Number));

/** The nudge after the user’s `turn`th message (from 1) to a Baby that knows only its first word, if any. */
export function nudge(turn: number): Notice | undefined {
	if (turn > LAST_NUDGE) {
		return (turn - LAST_NUDGE) % NUDGE_REPEAT === 0 ? NUDGES[LAST_NUDGE] : undefined;
	}
	return NUDGES[turn];
}
