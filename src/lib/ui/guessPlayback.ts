import type { ReplyStep } from '#lib/baby/index.ts';

/**
 * How the Graph plays a reply back: one step at a time, each the odds Baby had at
 * one word, in the order it picked them. The reply line under the map shows each
 * word as it’s reached.
 */

/**
 * Whether `next` is `previous` with more of it said, so playback carries on from
 * where it is; otherwise it’s another reply, played from its first word. A reply
 * being said only ever adds steps and picks words at its last one, keeping the odds.
 */
export function continues(previous: readonly ReplyStep[], next: readonly ReplyStep[]): boolean {
	return (
		previous.length > 0 &&
		next.length >= previous.length &&
		previous.every((step, index) => next[index]?.guesses === step.guesses)
	);
}

/**
 * How long each step shows before the next, in ms: `step`, or less for a long reply,
 * so that playing every step of `steps` takes no longer than `total`.
 */
export function stepDuration(steps: number, { step, total }: { step: number; total: number }) {
	return steps > 1 ? Math.min(step, total / (steps - 1)) : step;
}

/** How a word of the reply line looks: not reached yet, one of the rest, or the one shown. */
export type WordLook = 'hidden' | 'dim' | 'shown';

/**
 * How word `index` of the reply looks with step `at` on the map. Words past
 * `reached`, the furthest step played so far, aren’t shown yet. `focused` (a word
 * pointed at or stepped to) dims every other word, except at the step where Baby
 * ended the reply, which is all of them.
 */
export function wordLook(
	index: number,
	{
		at,
		reached,
		focused,
		steps
	}: { at: number; reached: number; focused: boolean; steps: readonly ReplyStep[] }
): WordLook {
	if (index > reached) return 'hidden';
	if (!focused || steps[at]?.picked === undefined || index === at) return 'shown';
	return 'dim';
}
