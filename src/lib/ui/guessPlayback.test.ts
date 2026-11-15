import { describe, expect, it } from 'vitest';
import type { ReplyStep } from '#lib/baby/index.ts';
import { continues, stepDuration, wordLook } from './guessPlayback.ts';

const odds = () => [{ word: 'hi', chance: 1 }];

describe('continues', () => {
	const first: ReplyStep = { guesses: odds() };

	it('carries on through a reply being said: a word picked, then the next odds', () => {
		const picked = [{ ...first, picked: 'hi' }];
		expect(continues([first], picked)).toBe(true);
		expect(continues(picked, [...picked, { guesses: odds() }])).toBe(true);
	});

	it('starts over for another reply, even one that starts with the same words', () => {
		expect(continues([first], [{ guesses: odds() }])).toBe(false);
		expect(continues([], [first])).toBe(false);
		expect(continues([first, first], [first])).toBe(false);
	});
});

describe('stepDuration', () => {
	const durations = { step: 1000, total: 10_000 };

	it('gives each step its time, unless the whole reply would take longer than the total', () => {
		expect(stepDuration(5, durations)).toBe(1000);
		expect(stepDuration(41, durations)).toBe(250);
		expect(stepDuration(1, durations)).toBe(1000);
	});
});

describe('wordLook', () => {
	const steps: ReplyStep[] = [
		{ guesses: odds(), picked: 'thank' },
		{ guesses: odds(), picked: 'you' },
		{ guesses: odds() }
	];
	const looks = (options: { at: number; reached: number; focused: boolean }) =>
		[0, 1].map((index) => wordLook(index, { ...options, steps }));

	it('shows each word once playback reaches it', () => {
		expect(looks({ at: 0, reached: 0, focused: false })).toEqual(['shown', 'hidden']);
		expect(looks({ at: 1, reached: 1, focused: false })).toEqual(['shown', 'shown']);
	});

	it('dims the other words around the one focused, any already reached', () => {
		expect(looks({ at: 0, reached: 2, focused: true })).toEqual(['shown', 'dim']);
		expect(looks({ at: 1, reached: 2, focused: true })).toEqual(['dim', 'shown']);
	});

	it('shows every word where Baby ended the reply', () => {
		expect(looks({ at: 2, reached: 2, focused: true })).toEqual(['shown', 'shown']);
	});
});
