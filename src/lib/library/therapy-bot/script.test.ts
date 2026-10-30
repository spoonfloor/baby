import { describe, expect, it } from 'vitest';
import { exchanges, heldOutExchanges, reflect } from './script.ts';

describe('reflect', () => {
	it('points your words back at you', () => {
		expect(reflect('finish my work')).toBe('finish your work');
		expect(reflect('ignores me')).toBe('ignores you');
		expect(reflect('coffee')).toBe('coffee');
	});
});

describe('Therapy Bot’s script', () => {
	it('gives every line one reply', () => {
		const replies = new Map<string, Set<string>>();
		for (const [you, baby] of exchanges) {
			replies.set(you, (replies.get(you) ?? new Set()).add(baby));
		}
		for (const set of replies.values()) expect(set.size).toBe(1);
	});

	it('never reads what the lab holds out', () => {
		const read = new Set(exchanges.map(([you]) => you.replace(/[.!]$/, '')));
		for (const { exchange } of heldOutExchanges) {
			expect(read.has(exchange[0].replace(/[.!]$/, ''))).toBe(false);
		}
	});

	it('copies what the lab expects into each held-out reply', () => {
		for (const { exchange, echo } of heldOutExchanges) expect(exchange[1]).toContain(echo);
	});
});
