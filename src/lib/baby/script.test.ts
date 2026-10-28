import { describe, expect, it } from 'vitest';
import { parseScripts, turnTokens } from './script.ts';

describe('turnTokens', () => {
	it('labels the speaker and ends the turn with [EOS]', () => {
		expect(turnTokens('baby', 'Hi!')).toEqual(['baby', ':', 'hi', '!', '[EOS]']);
	});
});

describe('parseScripts', () => {
	it('makes each conversation, separated by blank lines, its own document', () => {
		const documents = parseScripts(`
			you: Hi Baby!
			baby: Hi!

			you: Bye.
			baby: Bye!
		`);

		expect(documents).toEqual([
			['you', ':', 'hi', 'baby', '!', '[EOS]', 'baby', ':', 'hi', '!', '[EOS]'],
			['you', ':', 'bye', '.', '[EOS]', 'baby', ':', 'bye', '!', '[EOS]']
		]);
	});

	it('rejects lines that aren’t a known speaker’s turn', () => {
		expect(() => parseScripts('you: Hi\nmom: Hello')).toThrow(SyntaxError);
		expect(() => parseScripts('Hi there')).toThrow(SyntaxError);
	});
});
