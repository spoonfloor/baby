import { describe, expect, it } from 'vitest';
import { parseScripts, turnTokens } from './script.ts';

describe('turnTokens', () => {
	it('starts the turn with the speaker’s marker and ends it with [EOS]', () => {
		expect(turnTokens('baby', 'Hi!')).toEqual(['[BABY]', 'hi', '!', '[EOS]']);
		expect(turnTokens('you', 'Thank you')).toEqual(['[YOU]', 'thank', 'you', '[EOS]']);
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
			['[YOU]', 'hi', 'baby', '!', '[EOS]', '[BABY]', 'hi', '!', '[EOS]'],
			['[YOU]', 'bye', '.', '[EOS]', '[BABY]', 'bye', '!', '[EOS]']
		]);
	});

	it('rejects lines that aren’t a known speaker’s turn', () => {
		expect(() => parseScripts('you: Hi\nmom: Hello')).toThrow(SyntaxError);
		expect(() => parseScripts('Hi there')).toThrow(SyntaxError);
	});
});
