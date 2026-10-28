/**
 * What the app (the Coach) says, in its own voice, separate from Baby's. Notices
 * are stored by name and turned into copy at render time, so copy that depends on
 * the device (Click vs Tap) stays current.
 */
export type Notice = 'newborn' | 'failed';

export function noticeText(notice: Notice, pointerVerb: 'Click' | 'Tap'): string {
	switch (notice) {
		case 'newborn':
			return `Baby tried and failed to think of anything to say. Baby is brand new and knows literally nothing. ${pointerVerb} the + in the reply box below to start Baby’s training.`;
		case 'failed':
			return 'Something went wrong in the app, so Baby couldn’t finish. Try again.';
	}
}
