import { describe, expect, it } from 'vitest';
import { nudge } from './notices.ts';

describe('nudge', () => {
	it('lets the first reply speak for itself, then nudges on turns 2, 3 and 6', () => {
		expect(nudge(1)).toBeUndefined();
		expect(nudge(2)).toBe('oneWord');
		expect(nudge(3)).toBe('guess');
		expect([4, 5].map(nudge)).toEqual([undefined, undefined]);
		expect(nudge(6)).toBe('repertoire');
	});

	it('repeats the last nudge every 10 turns after it, indefinitely', () => {
		expect(nudge(16)).toBe('repertoire');
		expect(nudge(26)).toBe('repertoire');
		expect(nudge(1006)).toBe('repertoire');
		expect([7, 15, 17, 25].map(nudge)).toEqual([undefined, undefined, undefined, undefined]);
	});
});
