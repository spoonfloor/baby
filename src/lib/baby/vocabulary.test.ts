import { describe, expect, it } from 'vitest';
import { tokenize, UNK_ID, Vocabulary } from './vocabulary.ts';

describe('tokenize', () => {
	it('splits into lowercase words, with each punctuation mark a word of its own', () => {
		expect(tokenize('Hi, Baby! How are you?')).toEqual([
			'hi',
			',',
			'baby',
			'!',
			'how',
			'are',
			'you',
			'?'
		]);
	});

	it('treats curly and straight apostrophes as the same word', () => {
		expect(tokenize('don’t')).toEqual(tokenize(`don${String.fromCharCode(39)}t`));
	});
});

describe('Vocabulary', () => {
	it('starts knowing no words', () => {
		const vocabulary = new Vocabulary();
		expect(vocabulary.size).toBe(0);
		expect(vocabulary.wordIds).toEqual([]);
		expect(vocabulary.words).toEqual([]);
	});

	it('learns new words once and reports how many were new', () => {
		const vocabulary = new Vocabulary();
		expect(vocabulary.add(['moon', 'cow', 'moon'])).toBe(2);
		expect(vocabulary.add(['cow', 'spoon'])).toBe(1);
		expect(vocabulary.size).toBe(3);
		expect(vocabulary.words).toEqual(['moon', 'cow', 'spoon']);
	});

	it('maps unknown words to [UNK]', () => {
		const vocabulary = new Vocabulary();
		vocabulary.add(['moon']);
		expect(vocabulary.id('moon')).not.toBe(UNK_ID);
		expect(vocabulary.id('cake')).toBe(UNK_ID);
	});
});
