import { describe, expect, it } from 'vitest';
import { typeset } from './typeset.ts';
import { tokenize } from './vocabulary.ts';

const set = (words: string) => typeset(words.split(' '));

describe('typeset', () => {
	it('puts punctuation against the word before it', () => {
		expect(set('good evening !')).toBe('Good evening!');
		expect(set('hi , there .')).toBe('Hi, there.');
	});

	it('capitalizes each sentence, “I”, and names', () => {
		expect(set('i am good . how are you ?')).toBe('I am good. How are you?');
		expect(set('my name is baby .')).toBe('My name is Baby.');
		expect(typeset(tokenize('hi! i’m new'))).toBe('Hi! I’m new');
	});

	it('uses curly apostrophes', () => {
		expect(typeset(tokenize('it’s going well!'))).toBe('It’s going well!');
	});

	it('keeps Baby’s odd output as it is, only spaced and capitalized', () => {
		expect(set('! ! hi')).toBe('!! Hi');
		expect(set('( hi ) there')).toBe('(Hi) there');
		expect(typeset([])).toBe('');
	});

	it('undoes tokenizing for ordinary sentences', () => {
		const text = 'Hey, how’s it going? I am happy today, Baby!';
		expect(typeset(tokenize(text))).toBe(text);
	});
});
