import { describe, expect, it } from 'vitest';
import { parseScripts } from '#lib/baby/script.ts';
import type { Primer } from '#lib/library/index.ts';
import type { BabyMessage, Message } from './chat.svelte.ts';
import { transcript, type TranscriptOptions } from './transcript.ts';

const aboutBaby: Primer = {
	id: 'about-baby',
	title: 'About Baby',
	documents: parseScripts(
		'you: Hi!\nbaby: Hi!\n\nyou: Are you smart?\nbaby: Not yet. I am still learning.'
	)
};
const unread: Primer = {
	id: 'unread',
	title: 'Unread',
	documents: parseScripts('you: Hey.\nbaby: Hello !')
};

const options: TranscriptOptions = {
	knowledge: {
		words: ['hi', '!', 'not', 'yet'],
		sources: [{ id: 'about-baby' }],
		revision: 'r1',
		undoable: false
	},
	primers: [unread, aboutBaby],
	noticeText: (notice) => `[${notice}]`,
	at: new Date(2026, 9, 27, 14, 32)
};

const reply = (text: string, extra: Partial<BabyMessage> = {}): BabyMessage => ({
	id: crypto.randomUUID(),
	role: 'baby',
	request: 'reply',
	text,
	status: 'Picked some words',
	pending: false,
	...extra
});

const lines = (messages: Message[]) => transcript(messages, options).split('\n');

describe('transcript', () => {
	it('heads with what Baby knows, naming read primers', () => {
		expect(lines([])[1]).toBe('Knows 4 words · read About Baby');
		expect(transcript([], { ...options, knowledge: undefined }).split('\n')[1]).toBe(
			'Knows 0 words · read nothing'
		);
	});

	it('lays out each reply with what Baby saw, unknown words, and why it stopped', () => {
		const messages: Message[] = [
			{ id: '1', role: 'user', text: 'are you ok?' },
			reply('hi !', {
				trace: {
					prompt: ['are', 'you', 'ok', '?'],
					unknown: ['ok'],
					context: ['[YOU]', 'are', 'you', '[UNK]', '?', '[EOS]', '[BABY]'],
					stop: 'eos'
				}
			})
		];

		expect(lines(messages).slice(3)).toEqual([
			'─'.repeat(30),
			'you: are you ok?',
			'baby: hi !',
			'  status:   Picked some words',
			'  saw:      [YOU] are you [UNK] ? [EOS] [BABY]',
			'  known:    3 of 4 · unknown: ok',
			'  stopped:  picked [EOS]',
			'  verbatim: matches “About Baby” (reply to “hi !”)',
			''
		]);
	});

	it('flags a reply recited from a read primer, with the turn it answered there', () => {
		expect(lines([reply('not yet . i am still learning .')])).toContain(
			'  verbatim: matches “About Baby” (reply to “are you smart ?”)'
		);
	});

	it('ignores primers Baby hasn’t read, and partial turns', () => {
		const text = lines([reply('hello !'), reply('not yet .')]).join('\n');
		expect(text).not.toContain('verbatim');
	});

	it('shows readings, empty replies and the app’s notices', () => {
		const messages: Message[] = [
			reply('', { request: 'read', status: 'Read “About Baby”: 9 words · 9 new' }),
			reply(''),
			{ id: '2', role: 'app', notice: 'oneWord' }
		];

		expect(lines(messages).slice(3)).toEqual([
			'─'.repeat(30),
			'reading: Read “About Baby”: 9 words · 9 new',
			'baby: (nothing)',
			'  status:   Picked some words',
			'app: [oneWord]',
			''
		]);
	});
});
