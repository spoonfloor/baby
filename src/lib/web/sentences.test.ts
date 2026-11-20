import { describe, expect, it } from 'vitest';
import { plainParagraphs } from './extract.ts';
import { readableSentences, splitSentences } from './sentences.ts';

describe('splitSentences', () => {
	it('splits at sentence ends', () => {
		expect(splitSentences('The boat sank. Dozens are missing! Is anyone safe?')).toEqual([
			'The boat sank.',
			'Dozens are missing!',
			'Is anyone safe?'
		]);
	});

	it('keeps titles, initials, and quotes inside their sentence', () => {
		expect(
			splitSentences('Dr. Lee met J. Smith in Washington, D.C. on Monday. She said “hi!” and left.')
		).toEqual(['Dr. Lee met J. Smith in Washington, D.C. on Monday.', 'She said “hi!” and left.']);
	});
});

describe('readableSentences', () => {
	it('keeps sentences of writing, one each, and drops what isn’t one', () => {
		expect(
			readableSentences([
				'Opportunities and risks',
				'Miss North Carolina Says She Never Approved the Apology!',
				'BREAKING NEWS: STOCKS FALL TODAY.',
				'The company raised money. Read more at https://example.com/story today.',
				'Up 12% to 340 in 2026.',
				'Thanks.',
				'The company raised money.'
			])
		).toEqual(['The company raised money.']);
	});

	it('keeps every line of text with no sentences, like a list', () => {
		expect(readableSentences(['Eggs', 'Milk and butter'])).toEqual(['Eggs', 'Milk and butter']);
	});
});

describe('plainParagraphs', () => {
	it('joins hard-wrapped lines and drops page numbers and running heads', () => {
		const page = (n: number, text: string) => `A Tale of Two Cities\n\n${text}\n\nPage ${n} of 3`;
		const text = [
			page(1, 'It was the best of times,\nit was the worst of times.'),
			page(2, 'It was the age of wisdom.'),
			page(3, 'It was the age of foolishness.\n12')
		].join('\n\n');
		expect(plainParagraphs(text)).toEqual([
			'It was the best of times, it was the worst of times.',
			'It was the age of wisdom.',
			'It was the age of foolishness.'
		]);
	});
});
