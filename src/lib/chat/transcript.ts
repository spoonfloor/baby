import type { BabyState, Document, ReplyTrace } from '#lib/baby/index.ts';
import { count } from '#lib/baby/reading.ts';
import { TURN_START } from '#lib/baby/script.ts';
import { EOS, tokenize } from '#lib/baby/vocabulary.ts';
import type { Primer } from '#lib/library/index.ts';
import type { Message } from './chat.svelte.ts';
import type { Notice } from './notices.ts';

/**
 * The whole conversation as plain text, for debugging Baby: what was said, and for
 * each reply, what Baby actually saw, which words it didn’t know, why it stopped,
 * and whether it recited something it read.
 */

export interface TranscriptOptions {
	/** What Baby knows now. */
	knowledge: BabyState | undefined;
	/** Every primer there is; the ones Baby has read are looked up in it. */
	primers: readonly Primer[];
	/** The app’s words for a notice. */
	noticeText: (notice: Notice) => string;
	at: Date;
}

const RULE = '─'.repeat(30);

export function transcript(
	messages: readonly Message[],
	{ knowledge, primers, noticeText, at }: TranscriptOptions
): string {
	const read = (knowledge?.sources ?? []).flatMap(
		(source) => primers.find((primer) => primer.id === source) ?? []
	);
	const lines = [
		`Baby transcript · ${at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`,
		`Knows ${count(knowledge?.words.length ?? 0, 'word')} · read ${read.map((primer) => primer.title).join(', ') || 'nothing'}`
	];

	for (const message of messages) {
		switch (message.role) {
			case 'user':
				lines.push('', RULE, `you: ${message.text}`);
				break;
			case 'app':
				lines.push(`app: ${noticeText(message.notice)}`);
				break;
			case 'baby':
				if (message.request === 'read') {
					lines.push('', RULE, `reading: ${message.status}`);
					break;
				}
				lines.push(`baby: ${message.text || '(nothing)'}`, `  status:   ${message.status}`);
				if (message.trace) lines.push(...traceLines(message.trace));
				if (message.text) {
					const match = recited(tokenize(message.text), read);
					if (match) {
						lines.push(`  verbatim: matches “${match.primer}” (reply to “${match.prompt}”)`);
					}
				}
				break;
		}
	}
	return lines.join('\n') + '\n';
}

const STOPS: Record<ReplyTrace['stop'], string> = {
	eos: 'picked [EOS]',
	turn: 'picked a turn start, as if its turn were over',
	limit: 'reached the longest reply'
};

function traceLines({ prompt, unknown, context, stop }: ReplyTrace): string[] {
	const known = prompt.filter((word) => !unknown.includes(word)).length;
	return [
		`  saw:      ${context.join(' ')}`,
		`  known:    ${known} of ${prompt.length}` +
			(unknown.length > 0 ? ` · unknown: ${unknown.join(', ')}` : ''),
		`  stopped:  ${STOPS[stop]}`
	];
}

/**
 * The first read primer with a Baby turn saying exactly `reply`, and the turn it
 * answered there.
 */
function recited(
	reply: readonly string[],
	primers: readonly Primer[]
): { primer: string; prompt: string } | undefined {
	const turn = [TURN_START.baby, ...reply, EOS];
	for (const primer of primers) {
		for (const document of primer.documents) {
			const start = turnStarts(document).find((index) =>
				turn.every((token, offset) => document[index + offset] === token)
			);
			if (start === undefined) continue;
			const previous = turnStarts(document).findLast((index) => index < start);
			const prompt =
				previous === undefined ? '' : document.slice(previous + 1, start - 1).join(' ');
			return { primer: primer.title, prompt };
		}
	}
	return undefined;
}

/** Where each turn begins: the start, and just after every [EOS]. */
function turnStarts(document: Document): number[] {
	return [0, ...document.flatMap((token, index) => (token === EOS ? [index + 1] : []))].filter(
		(index) => index < document.length
	);
}
