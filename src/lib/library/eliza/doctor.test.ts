import { describe, expect, it } from 'vitest';
import { Doctor } from './doctor.ts';

describe('Doctor', () => {
	it('reflects your words back, swapping I and you, my and your', () => {
		expect(new Doctor().respond('My toaster hates me.')).toBe('Your toaster hates you.');
		expect(new Doctor().respond('I want a nap.')).toBe(
			'What would it mean to you if you got a nap?'
		);
	});

	it('answers with the highest-ranked keyword', () => {
		// “computer” outranks “my”, which outranks “I”.
		expect(new Doctor().respond('I think my computer hates me.')).toBe('Do computers worry you?');
	});

	it('cycles through a rule’s replies', () => {
		const doctor = new Doctor();
		expect(doctor.respond('I am tired.')).toBe('Is it because you are tired that you came to me?');
		expect(doctor.respond('I am bored.')).toBe('How long have you been bored?');
	});

	it('follows links to other keywords’ rules', () => {
		expect(new Doctor().respond('You remind me of a dentist.')).toBe('In what way?');
		expect(new Doctor().respond('Why do you ask so many questions?')).toBe('Why do you ask?');
	});

	it('tries the next keyword when one gives up', () => {
		// “like” only answers in comparisons (“is like”), so “I” answers instead.
		expect(new Doctor().respond('I like soup.')).toBe('You say you like soup.');
	});

	it('reads only the first clause with a keyword', () => {
		expect(new Doctor().respond('It rained, and I am sad.')).toBe(
			'I am sorry to hear you are sad.'
		);
	});

	it('falls back when nothing answers', () => {
		expect(new Doctor().respond('The weather is nice.')).toBe(
			'I am not sure I understand you fully.'
		);
	});
});
