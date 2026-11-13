import { describe, expect, it } from 'vitest';
import { finishedPart } from './draft.ts';

describe('finishedPart', () => {
	it('leaves out a word still being typed', () => {
		expect(finishedPart('i am sa')).toBe('i am');
		expect(finishedPart('hello')).toBe('');
		expect(finishedPart('i don’t')).toBe('i');
	});

	it('counts a word as finished once a space or punctuation follows it', () => {
		expect(finishedPart('i am sad ')).toBe('i am sad');
		expect(finishedPart('i am sad.')).toBe('i am sad.');
		expect(finishedPart('hi, ')).toBe('hi,');
	});

	it('is empty for an empty draft', () => {
		expect(finishedPart('')).toBe('');
		expect(finishedPart('   ')).toBe('');
	});
});
